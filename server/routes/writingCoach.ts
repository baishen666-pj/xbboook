import { Router } from 'express';
import { z } from 'zod';
import { completeChat } from '../ai/agentFactory.js';
import { getSkill } from '../ai/writingSkills.js';
import { validate } from '../middleware/validate.js';
import { chapterRepo } from '../db/repositories/chapterRepo.js';

const router = Router({ mergeParams: true });

const coachSchema = z.object({
  chapterIds: z.array(z.string()).optional(),
  focusAreas: z.array(z.enum(['narrative', 'character', 'pacing', 'prose', 'emotion', 'structure', 'dialogue', 'all'])).default(['all']),
});

router.post('/coach', validate(coachSchema), async (req, res) => {
  const skill = getSkill('writing-coach');
  const { projectId } = req.params;
  const { chapterIds, focusAreas } = req.body;

  const chapters = chapterIds?.length
    ? chapterRepo.findByProject(projectId).filter(c => chapterIds.includes(c.id))
    : chapterRepo.findByProject(projectId);

  const chapterInfo = chapters.slice(0, 15).map((c, i) => {
    const content = c.content || '';
    return `第${i + 1}章《${c.title}》| 字数:${content.length} | 内容片段:${content.slice(0, 300)}`;
  }).join('\n');

  const focusLabels: Record<string, string> = {
    narrative: '叙事技巧', character: '角色塑造', pacing: '节奏把控', prose: '文笔功底',
    emotion: '情感表达', structure: '结构设计', dialogue: '对话写作', all: '全部维度',
  };

  const prompt = `请作为写作教练，从以下维度评估这部作品的写作水平：${focusAreas.map(f => focusLabels[f]).join('、')}

作品章节：
${chapterInfo}

以JSON格式返回：
{
  "overall_level": "beginner/intermediate/advanced/master",
  "overall_score": 72,
  "dimensions": {
    "narrative": {"score": 75, "level": "intermediate", "strength": "优点", "weakness": "不足", "improvement": "改进方向"},
    "character": {"score": 68, "level": "intermediate", "strength": "优点", "weakness": "不足", "improvement": "改进方向"},
    "pacing": {"score": 80, "level": "advanced", "strength": "优点", "weakness": "不足", "improvement": "改进方向"},
    "prose": {"score": 70, "level": "intermediate", "strength": "优点", "weakness": "不足", "improvement": "改进方向"},
    "emotion": {"score": 65, "level": "beginner", "strength": "优点", "weakness": "不足", "improvement": "改进方向"},
    "structure": {"score": 78, "level": "advanced", "strength": "优点", "weakness": "不足", "improvement": "改进方向"},
    "dialogue": {"score": 72, "level": "intermediate", "strength": "优点", "weakness": "不足", "improvement": "改进方向"}
  },
  "exercises": [{
    "area": "情感表达",
    "title": "练习名称",
    "description": "练习描述",
    "prompt": "具体的练习提示",
    "difficulty": "easy/medium/hard",
    "estimated_time": "15分钟"
  }],
  "reading_recommendations": [{"title": "推荐书籍", "author": "作者", "reason": "推荐理由", "focus": "学习重点"}],
  "milestone_goals": [{"goal": "目标描述", "timeline": "1周/1月", "success_criteria": "达成标准"}],
  "encouragement": "鼓励性评语"
}`;

  try {
    const response = await completeChat(
      [{ role: 'system', content: skill?.systemPrompt || '' }, { role: 'user', content: prompt }],
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

const weaknessSchema = z.object({
  chapterId: z.string(),
  severity: z.enum(['critical', 'high', 'medium', 'low', 'all']).default('all'),
});

router.post('/weakness', validate(weaknessSchema), async (req, res) => {
  const skill = getSkill('weakness-detect');
  const { chapterId, severity } = req.body;
  const chapter = chapterRepo.findById(chapterId);
  if (!chapter) return res.status(404).json({ success: false, error: '章节不存在' });

  const content = chapter.content || '';
  const prompt = `请检测以下章节中的写作弱点${severity !== 'all' ? `，重点关注${severity}级别的问题` : ''}。

章节标题：${chapter.title}
内容：
${content.slice(0, 4000)}

以JSON格式返回：
{
  "total_issues": 8,
  "severity_breakdown": {"critical": 1, "high": 2, "medium": 3, "low": 2},
  "issues": [{
    "id": 1,
    "type": "repetition/passive_voice/weak_dialogue/over_description/under_description/flat_character/logic_gap/pacing/telling_not_showing",
    "type_name": "问题类型名称",
    "severity": "critical/high/medium/low",
    "location": "问题位置描述",
    "original_text": "原文片段",
    "problem": "问题说明",
    "fixed_text": "修改示范",
    "explanation": "修改理由"
  }],
  "patterns": [{"name": "反复出现的模式", "frequency": 3, "impact": "影响", "fix": "解决方案"}],
  "overall_assessment": {
    "quality_score": 72,
    "biggest_strength": "最大优点",
    "biggest_weakness": "最大弱点",
    "priority_fix": "最优先修复"
  }
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
