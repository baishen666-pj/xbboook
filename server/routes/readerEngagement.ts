import { Router } from 'express';
import { z } from 'zod';
import { completeChat } from '../ai/agentFactory.js';
import { getSkill } from '../ai/writingSkills.js';
import { validate } from '../middleware/validate.js';
import { chapterRepo } from '../db/repositories/chapterRepo.js';

const router = Router({ mergeParams: true });

const engagementSchema = z.object({
  chapterIds: z.array(z.string()).optional(),
});

router.post('/predict', validate(engagementSchema), async (req, res) => {
  const skill = getSkill('engagement-predict');
  const { projectId } = req.params;
  const { chapterIds } = req.body;

  const chapters = chapterIds?.length
    ? chapterRepo.findByProject(projectId).filter(c => chapterIds.includes(c.id))
    : chapterRepo.findByProject(projectId);

  const chapterInfo = chapters.slice(0, 25).map((c, i) => {
    const content = c.content || '';
    return `第${i + 1}章《${c.title}》| 字数:${content.length} | 开头:${content.slice(0, 100)} | 结尾:${content.slice(-100)}`;
  }).join('\n');

  const prompt = `请分析以下小说各章节的读者参与度预测。

${chapterInfo}

以JSON格式返回：
{
  "chapters": [${chapters.slice(0, 25).map((_, i) => `{
    "chapter": ${i + 1},
    "title": "标题",
    "engagement_score": 75,
    "retention_probability": 82,
    "reading_time_minutes": 12,
    "scroll_depth_predicted": 85,
    "factors": {
      "hook_strength": 80,
      "conflict_level": 70,
      "character_appeal": 75,
      "plot_advancement": 65,
      "emotional_impact": 70,
      "information_value": 60
    },
    "risk_flags": ["节奏偏慢"],
    "highlights": ["精彩的伏笔设置"]
  }`).join(',')}],
  "overall": {
    "average_engagement": 75,
    "predicted_completion_rate": 68,
    "dropoff_chapters": [{"chapter": 5, "probability": 35, "reason": "原因"}],
    "peak_chapters": [{"chapter": 3, "reason": "高潮节点"}],
    "engagement_trend": "rising/stable/declining",
    "recommendations": ["建议"]
  }
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

const hookSchema = z.object({
  chapterId: z.string(),
});

router.post('/hook-score', validate(hookSchema), async (req, res) => {
  const skill = getSkill('hook-score');
  const { chapterId } = req.body;
  const chapter = chapterRepo.findById(chapterId);
  if (!chapter) return res.status(404).json({ success: false, error: '章节不存在' });

  const content = chapter.content || '';
  const opening = content.slice(0, 500);
  const ending = content.slice(-500);

  const prompt = `请评估以下章节的开头钩子和结尾悬念。

章节标题：${chapter.title}
总字数：${content.length}

开头（前500字）：
${opening}

结尾（后500字）：
${ending}

以JSON格式返回：
{
  "opening": {
    "score": 80,
    "technique": "使用的技术（如：悬念、冲突、反转）",
    "strength": ["优点"],
    "weakness": ["不足"],
    "improved_version": "改进后的开头（200字以内）",
    "technique_tags": ["悬念", "冲突", "感官"]
  },
  "ending": {
    "score": 85,
    "technique": "悬念类型",
    "cliffhanger_strength": 90,
    "strength": ["优点"],
    "weakness": ["不足"],
    "improved_version": "改进后的结尾（200字以内）",
    "technique_tags": ["悬念", "反转", "情感"]
  },
  "overall_hook_score": 82,
  "reader_retention_impact": "强钩子将提升15%留存率",
  "suggestions": ["建议"]
}`;

  try {
    const response = await completeChat(
      [{ role: 'system', content: skill?.systemPrompt || '' }, { role: 'user', content: prompt }],
      { temperature: skill?.temperature ?? 0.5, maxTokens: skill?.maxTokens ?? 4000 },
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
