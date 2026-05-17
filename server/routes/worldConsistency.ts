import { Router } from 'express';
import { z } from 'zod';
import { completeChat } from '../ai/agentFactory.js';
import { getSkill } from '../ai/writingSkills.js';
import { validate } from '../middleware/validate.js';
import { chapterRepo } from '../db/repositories/chapterRepo.js';

const router = Router({ mergeParams: true });

const checkSchema = z.object({
  chapterIds: z.array(z.string()).optional(),
  dimensions: z.array(z.enum(['geography', 'magic', 'technology', 'society', 'history', 'economy', 'races', 'all'])).default(['all']),
});

router.post('/check', validate(checkSchema), async (req, res) => {
  const skill = getSkill('world-consistency');
  const { projectId } = req.params;
  const { chapterIds, dimensions } = req.body;

  const chapters = chapterIds?.length
    ? chapterRepo.findByProject(projectId).filter(c => chapterIds.includes(c.id))
    : chapterRepo.findByProject(projectId);

  const chapterText = chapters.slice(0, 20).map((c, i) => {
    const content = c.content || '';
    return `第${i + 1}章《${c.title}》| ${content.slice(0, 300)}`;
  }).join('\n');

  const dimLabels: Record<string, string> = {
    geography: '地理设定', magic: '魔法体系', technology: '科技水平', society: '社会制度',
    history: '历史时间线', economy: '经济系统', races: '种族/势力', all: '全部维度',
  };

  const prompt = `请检查以下小说世界观的一致性，重点关注：${dimensions.map(d => dimLabels[d]).join('、')}

章节内容：
${chapterText.slice(0, 6000)}

以JSON格式返回：
{
  "world_elements": {
    "geography": {"established": ["已建立的地理设定"], "confidence": 80},
    "magic_or_power": {"established": ["魔法/力量体系设定"], "rules": ["体系规则"], "confidence": 75},
    "technology": {"level": "科技水平", "established": ["科技设定"], "confidence": 85},
    "society": {"structure": "社会结构", "established": ["社会设定"], "confidence": 70},
    "history": {"timeline": ["历史事件"], "confidence": 65},
    "economy": {"system": "经济体系", "established": ["经济设定"], "confidence": 60},
    "races_factions": {"groups": ["种族/势力"], "relationships": ["关系"], "confidence": 75}
  },
  "inconsistencies": [{
    "id": 1,
    "severity": "critical/high/medium/low",
    "dimension": "magic",
    "description": "矛盾描述",
    "location_1": {"chapter": 3, "text": "设定A"},
    "location_2": {"chapter": 7, "text": "矛盾设定B"},
    "fix_options": [{"approach": "修正方案", "impact": "影响评估", "difficulty": "easy/hard"}]
  }],
  "gaps": [{
    "dimension": "economy",
    "description": "缺失的设定",
    "importance": "high/medium/low",
    "suggestion": "建议补充"
  }],
  "overall_consistency": 75,
  "recommendations": ["改进建议"]
}`;

  try {
    const response = await completeChat(
      [{ role: 'system', content: skill?.systemPrompt || '' }, { role: 'user', content: prompt }],
      { temperature: skill?.temperature ?? 0.35, maxTokens: skill?.maxTokens ?? 5000 },
    );
    let parsed;
    try { parsed = JSON.parse(response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()); } catch {
      const m = response.match(/\{[\s\S]*\}/);
      if (!m) return res.json({ success: false, error: 'AI 返回格式异常', raw: response });
      parsed = JSON.parse(m[0]);
    }
    res.json({ success: true, data: parsed });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : '请求失败' });
  }
});

export default router;
