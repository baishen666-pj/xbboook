import { Router } from 'express';
import { z } from 'zod';
import * as turningPointRepo from '../db/repositories/turningPointRepo.js';
import { buildPrompt, toMessages } from '../ai/promptBuilder.js';
import { getSkill } from '../ai/writingSkills.js';
import { getProvider } from '../ai/providers.js';
import { getConfig } from '../ai/configStore.js';
import { validate } from '../middleware/validate.js';

const router = Router({ mergeParams: true });

const TURN_TYPES = ['reversal', 'revelation', 'sacrifice', 'betrayal', 'growth', 'crisis', 'climax', 'other'] as const;
const SEVERITIES = ['minor', 'moderate', 'major', 'critical'] as const;

const createSchema = z.object({
  title: z.string().min(1).max(200),
  chapterId: z.string().optional(),
  description: z.string().max(2000).optional(),
  turnType: z.enum(TURN_TYPES).optional(),
  severity: z.enum(SEVERITIES).optional(),
});

const updateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  chapterId: z.string().nullable().optional(),
  description: z.string().max(2000).optional(),
  turnType: z.enum(TURN_TYPES).optional(),
  severity: z.enum(SEVERITIES).optional(),
  foreshadowPlanted: z.boolean().optional(),
  foreshadowResolved: z.boolean().optional(),
});

// List turning points
router.get('/', (req, res) => {
  const { projectId } = req.params;
  const points = turningPointRepo.findByProject(projectId);
  res.json({ success: true, data: points });
});

// Create turning point
router.post('/', validate(createSchema), (req, res) => {
  const { projectId } = req.params;
  const { title, chapterId, description, turnType, severity } = req.body;

  const point = turningPointRepo.create({
    projectId,
    title,
    chapterId,
    description,
    turnType,
    severity,
  });

  res.status(201).json({ success: true, data: point });
});

// Update turning point
router.patch('/:pointId', validate(updateSchema), (req, res) => {
  const { pointId } = req.params;
  const { foreshadowPlanted, foreshadowResolved, chapterId, ...rest } = req.body;

  const data: Record<string, unknown> = { ...rest };
  if (foreshadowPlanted !== undefined) data.foreshadow_planted = foreshadowPlanted ? 1 : 0;
  if (foreshadowResolved !== undefined) data.foreshadow_resolved = foreshadowResolved ? 1 : 0;
  if (chapterId !== undefined) data.chapter_id = chapterId;

  const updated = turningPointRepo.update(pointId, data);
  if (!updated) {
    return res.status(404).json({ success: false, error: '转折点不存在' });
  }
  res.json({ success: true, data: updated });
});

// Delete turning point
router.delete('/:pointId', (req, res) => {
  const deleted = turningPointRepo.deleteById(req.params.pointId);
  if (!deleted) {
    return res.status(404).json({ success: false, error: '转折点不存在' });
  }
  res.json({ success: true, data: null });
});

// AI analyze turning points
router.post('/analyze', async (req, res) => {
  const { projectId } = req.params;
  const points = turningPointRepo.findByProject(projectId);

  if (points.length === 0) {
    return res.json({ success: true, data: { score: 0, message: '暂无转折点' } });
  }

  const skill = getSkill('outline-analysis');
  if (!skill) {
    return res.status(500).json({ success: false, error: '技能不存在' });
  }

  const pointsDesc = points.map((p, i) =>
    `${i + 1}. ${p.title} (${p.turn_type}/${p.severity})${p.description ? `：${p.description.slice(0, 80)}` : ''}${p.foreshadow_planted ? ' [伏笔已埋]' : ''}${p.foreshadow_resolved ? ' [已回收]' : ''}`
  ).join('\n');

  const userMessage = `请分析以下剧情转折点安排的合理性：

${pointsDesc}

请评估：
1. 转折节奏是否合理
2. 伏笔回收是否到位
3. 建议调整的地方

输出JSON格式：
{
  "score": 85,
  "pacing_analysis": "节奏分析",
  "foreshadow_analysis": "伏笔分析",
  "suggestions": ["建议1", "建议2"],
  "unresolved": ["未回收的伏笔"]
}`;

  try {
    const config = getConfig();
    const prompt = buildPrompt({ skillId: 'outline-analysis', sources: [], userMessage });
    const provider = getProvider(config.provider);
    const messages = toMessages(prompt, [], skill.maxTokens);
    const result = await provider.chat(messages, {
      model: config.model, temperature: skill.temperature, maxTokens: skill.maxTokens,
    });

    let parsed;
    try {
      const jsonStr = result.content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsed = JSON.parse(jsonStr);
    } catch {
      return res.json({ success: false, error: 'AI 返回格式异常', raw: result.content });
    }

    res.json({ success: true, data: parsed });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'AI 请求失败';
    res.status(500).json({ success: false, error: message });
  }
});

export default router;
