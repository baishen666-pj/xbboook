import { Router } from 'express';
import { z } from 'zod';
import { completeChat } from '../ai/agentFactory.js';
import { getSkill } from '../ai/writingSkills.js';
import { validate } from '../middleware/validate.js';
import { chapterRepo } from '../db/repositories/chapterRepo.js';

const router = Router({ mergeParams: true });

const analyzeSchema = z.object({
  chapterIds: z.array(z.string()).optional(),
});

router.post('/analyze', validate(analyzeSchema), async (req, res) => {
  const skill = getSkill('info-density');
  const { projectId } = req.params;
  const { chapterIds } = req.body;

  const chapters = chapterIds?.length
    ? chapterRepo.findByProject(projectId).filter(c => chapterIds.includes(c.id))
    : chapterRepo.findByProject(projectId);

  const chapterInfo = chapters.slice(0, 25).map((c, i) => {
    const content = c.content || '';
    return `第${i + 1}章《${c.title}》| 字数:${content.length} | 内容:${content.slice(0, 250)}`;
  }).join('\n');

  const prompt = `请分析以下小说各章节的信息密度分布。

${chapterInfo.slice(0, 6000)}

以JSON格式返回：
{
  "chapter_density": [${chapters.slice(0, 25).map((_, i) => `{
    "chapter": ${i + 1},
    "title": "标题",
    "total_density": 72,
    "dimensions": {
      "worldbuilding": 80,
      "plot_advancement": 65,
      "character_development": 70,
      "new_concepts": 30,
      "emotional_payload": 75
    },
    "classification": "balanced/overload/sparse/action/dialogue_heavy",
    "issues": ["问题"]
  }`).join(',')}],
  "overload_chapters": [{"chapter": 3, "elements": ["过多新设定"], "suggestion": "分散到其他章节"}],
  "sparse_chapters": [{"chapter": 7, "missing": "缺乏新信息", "suggestion": "建议添加的内容"}],
  "distribution_assessment": {
    "overall_balance": 75,
    "pacing_impact": "信息分布对节奏的影响",
    "ideal_distribution": "理想分布描述"
  },
  "reorganization_plan": [{
    "action": "move/add/remove",
    "from_chapter": 3,
    "to_chapter": 5,
    "element": "需要移动的设定/信息",
    "reason": "原因"
  }],
  "tips": ["信息密度优化技巧"]
}`;

  try {
    const response = await completeChat(
      [{ role: 'system', content: skill?.systemPrompt || '' }, { role: 'user', content: prompt }],
      { temperature: skill?.temperature ?? 0.4, maxTokens: skill?.maxTokens ?? 5000 },
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
