import { Router } from 'express';
import { z } from 'zod';
import { completeChat } from '../ai/agentFactory.js';
import { getSkill } from '../ai/writingSkills.js';
import { validate } from '../middleware/validate.js';
import { chapterRepo } from '../db/repositories/chapterRepo.js';

const router = Router({ mergeParams: true });

const whatIfSchema = z.object({
  chapterId: z.string().optional(),
  content: z.string().optional(),
  aspect: z.enum(['plot', 'character', 'setting', 'conflict', 'ending', 'random']).default('random'),
  count: z.number().min(1).max(10).default(5),
});

router.post('/what-if', validate(whatIfSchema), async (req, res) => {
  const skill = getSkill('what-if');
  const { projectId } = req.params;
  const { chapterId, content, aspect, count } = req.body;

  let text = content || '';
  if (!text && chapterId) {
    const ch = chapterRepo.findById(chapterId);
    if (ch) text = ch.content || '';
  }
  if (!text) {
    const chapters = chapterRepo.findByProject(projectId);
    text = chapters.slice(0, 3).map(c => c.content || '').join('\n\n');
  }

  const aspectLabels: Record<string, string> = {
    plot: '剧情发展', character: '角色命运', setting: '场景设定',
    conflict: '冲突走向', ending: '结局', random: '随机方向',
  };

  const prompt = `基于以下文本，从"${aspectLabels[aspect]}"的角度，生成${count}个"如果"替代设想。

原文：
${text.slice(0, 3000)}

以JSON格式返回：
{
  "scenarios": [${Array.from({ length: count }, (_, i) => `{
    "id": ${i + 1},
    "what_if": "如果...会怎样？",
    "description": "这个设想的详细描述（100字以内）",
    "impact": "对整体故事的影响",
    "drama_potential": 85,
    "feasibility": 70,
    "reader_appeal": 80,
    "sample_paragraph": "这个方向的一个示例段落（200字以内）"
  }`).join(',')}],
  "best_pick": {"id": 1, "reason": "推荐理由"},
  "combination_hint": "可以将多个设想组合使用的建议"
}`;

  try {
    const response = await completeChat(
      [{ role: 'system', content: skill?.systemPrompt || '' }, { role: 'user', content: prompt }],
      { temperature: skill?.temperature ?? 0.9, maxTokens: skill?.maxTokens ?? 4000 },
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

const constraintSchema = z.object({
  content: z.string().optional(),
  chapterId: z.string().optional(),
  constraints: z.array(z.object({
    type: z.enum(['no_dialogue', 'no_adjectives', 'single_sentence', 'reverse_pov', 'stream_consciousness', 'letter_format', 'no_protagonist', 'time_limit']),
    description: z.string().optional(),
  })).min(1).max(3),
});

router.post('/constraint-write', validate(constraintSchema), async (req, res) => {
  const skill = getSkill('constraint-write');
  const { projectId } = req.params;
  const { content, chapterId, constraints } = req.body;

  let text = content || '';
  if (!text && chapterId) {
    const ch = chapterRepo.findById(chapterId);
    if (ch) text = ch.content || '';
  }
  if (!text) {
    const chapters = chapterRepo.findByProject(projectId);
    text = chapters.slice(0, 2).map(c => c.content || '').join('\n\n');
  }

  const constraintLabels: Record<string, string> = {
    no_dialogue: '无对话 — 纯叙述和描写',
    no_adjectives: '无形容词 — 用动词和名词表达',
    single_sentence: '单句段落 — 每段仅一句话',
    reverse_pov: '反转视角 — 从其他角色视角重写',
    stream_consciousness: '意识流 — 内心独白式',
    letter_format: '书信体 — 以信件形式呈现',
    no_protagonist: '无主角 — 用配角的视角讲述',
    time_limit: '限时 — 模拟实时发生的紧迫感',
  };

  const constraintDesc = constraints.map(c => constraintLabels[c.type] || c.description || c.type).join('、');

  const prompt = `请在以下创作限制下重写/创作文本。

限制条件：${constraintDesc}

原始文本（参考）：
${text.slice(0, 2000)}

以JSON格式返回：
{
  "constraints_applied": ["${constraints.map(c => c.type).join('", "')}"],
  "result_text": "限制创作后的文本",
  "creativity_score": 85,
  "unusual_elements": ["意外出现的新元素"],
  "strengths": ["在这种限制下展现的优势"],
  "technique_analysis": "限制如何激发了独特的表达方式",
  "tips": ["这种限制写作的技巧"]
}`;

  try {
    const response = await completeChat(
      [{ role: 'system', content: skill?.systemPrompt || '' }, { role: 'user', content: prompt }],
      { temperature: skill?.temperature ?? 0.85, maxTokens: skill?.maxTokens ?? 4000 },
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

const blendSchema = z.object({
  content: z.string().optional(),
  chapterId: z.string().optional(),
  genres: z.array(z.string()).min(2).max(4),
});

router.post('/genre-blend', validate(blendSchema), async (req, res) => {
  const skill = getSkill('genre-blend');
  const { projectId } = req.params;
  const { content, chapterId, genres } = req.body;

  let text = content || '';
  if (!text && chapterId) {
    const ch = chapterRepo.findById(chapterId);
    if (ch) text = ch.content || '';
  }
  if (!text) {
    const chapters = chapterRepo.findByProject(projectId);
    text = chapters.slice(0, 2).map(c => c.content || '').join('\n\n');
  }

  const prompt = `请将以下类型元素融合到当前故事中。

目标融合类型：${genres.join(' + ')}
当前文本（参考）：
${text.slice(0, 2000)}

以JSON格式返回：
{
  "blend_analysis": {
    "core_elements": {"${genres[0]}": ["元素1"], "${genres[1]}": ["元素2"]},
    "fusion_points": ["两个类型的自然融合点"],
    "potential_conflicts": ["类型冲突需要处理的地方"],
    "unique_opportunities": ["混搭带来的独特机会"]
  },
  "sample_scene": "融合后的示例场景（500字以内）",
  "character_adaptations": [{"name": "角色", "change": "如何适应新类型元素"}],
  "world_building_additions": ["需要添加的世界观元素"],
  "tone_recommendation": "整体基调建议",
  "reader_appeal": {"target_audience": "目标读者", "unique_selling_point": "独特卖点"},
  "risk_assessment": {"level": "medium", "factors": ["风险因素"], "mitigations": ["缓解措施"]},
  "tips": ["类型融合的创作技巧"]
}`;

  try {
    const response = await completeChat(
      [{ role: 'system', content: skill?.systemPrompt || '' }, { role: 'user', content: prompt }],
      { temperature: skill?.temperature ?? 0.9, maxTokens: skill?.maxTokens ?? 4000 },
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
