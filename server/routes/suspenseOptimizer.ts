import { Router } from 'express';
import { z } from 'zod';
import { completeChat } from '../ai/agentFactory.js';
import { getSkill } from '../ai/writingSkills.js';
import { validate } from '../middleware/validate.js';
import { chapterRepo } from '../db/repositories/chapterRepo.js';

const router = Router({ mergeParams: true });

const optimizeSchema = z.object({
  chapterIds: z.array(z.string()).optional(),
  mode: z.enum(['analyze', 'optimize', 'techniques']).default('analyze'),
});

router.post('/optimize', validate(optimizeSchema), async (req, res) => {
  const skill = getSkill('suspense-optimizer');
  const { projectId } = req.params;
  const { chapterIds, mode } = req.body;

  const chapters = chapterIds?.length
    ? chapterRepo.findByProject(projectId).filter(c => chapterIds.includes(c.id))
    : chapterRepo.findByProject(projectId);

  const chapterInfo = chapters.slice(0, 25).map((c, i) => {
    const content = c.content || '';
    return `第${i + 1}章《${c.title}》| 字数:${content.length} | 摘要:${c.ai_summary || content.slice(0, 150)}`;
  }).join('\n');

  const modePrompts: Record<string, string> = {
    analyze: `请分析以下小说的悬念设置和张力曲线。

${chapterInfo}

以JSON格式返回：
{
  "suspense_curve": [${chapters.slice(0, 25).map((_, i) => `{"chapter": ${i + 1}, "tension": ${Math.floor(Math.random() * 60) + 20}, "suspense_type": "信息差/倒计时/冲突/谜团", "hooks": ["悬念钩子"]}`).join(',')}],
  "techniques_used": [{"name": "悬念技巧", "chapters": [1, 3], "effectiveness": 80}],
  "weak_points": [{"chapter": 5, "issue": "悬念缺失", "suggestion": "建议添加的悬念元素"}],
  "peak_moments": [{"chapter": 8, "type": "高潮", "technique": "使用的悬念技巧"}],
  "overall_assessment": {
    "suspense_score": 72,
    "tension_rhythm": "张弛节奏评价",
    "sustained_interest": 75,
    "climax_effectiveness": 80
  }
}`,
    optimize: `请为以下章节提供悬念优化方案。

${chapterInfo}

以JSON格式返回：
{
  "optimizations": [${chapters.slice(0, 15).map((_, i) => `{
    "chapter": ${i + 1},
    "current_tension": 50,
    "optimized_tension": 75,
    "additions": [{"technique": "信息差", "description": "添加什么悬念", "sample_text": "示例文本（100字）"}],
    "removals": ["建议移除的破坏悬念的元素"],
    "reorder_suggestion": "节奏调整建议"
  }`).join(',')}],
  "new_hooks": [{"position": "章节末尾", "type": "悬念类型", "content": "建议添加的钩子"}],
  "timeline_adjustments": "时间线调整建议",
  "tips": ["悬念优化技巧"]
}`,
    techniques: `请分析以下小说中可应用的悬念技巧。

${chapterInfo}

以JSON格式返回：
{
  "applicable_techniques": [{
    "name": "信息差",
    "description": "技巧描述",
    "applicable_chapters": [1, 3],
    "implementation": "具体实施方法",
    "expected_impact": 85,
    "difficulty": "easy/medium/hard",
    "example": "示例（150字）"
  }],
  "technique_combinations": [{"combo": "技巧组合", "effect": "叠加效果", "chapters": [5, 6]}],
  "genre_specific_tips": ["该类型特有的悬念技巧"],
  "advanced_techniques": ["高级悬念技巧"],
  "common_mistakes": ["常见悬念写作错误"]
}`,
  };

  try {
    const response = await completeChat(
      [{ role: 'system', content: skill?.systemPrompt || '' }, { role: 'user', content: modePrompts[mode] }],
      { temperature: skill?.temperature ?? 0.5, maxTokens: skill?.maxTokens ?? 5000 },
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
