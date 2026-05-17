import { Router } from 'express';
import { z } from 'zod';
import { completeChat } from '../ai/agentFactory.js';
import { getSkill } from '../ai/writingSkills.js';
import { validate } from '../middleware/validate.js';
import { chapterRepo } from '../db/repositories/chapterRepo.js';

const router = Router({ mergeParams: true });

const predictSchema = z.object({
  chapterIds: z.array(z.string()).optional(),
  focus: z.enum(['retention', 'dropoff', 'engagement', 'all']).default('all'),
});

router.post('/predict', validate(predictSchema), async (req, res) => {
  const skill = getSkill('retention-predict');
  const { projectId } = req.params;
  const { chapterIds, focus } = req.body;

  const chapters = chapterIds?.length
    ? chapterRepo.findByProject(projectId).filter(c => chapterIds.includes(c.id))
    : chapterRepo.findByProject(projectId);

  const chapterAnalysis = chapters.slice(0, 20).map((c, i) => {
    const content = c.content || '';
    return `第${i + 1}章《${c.title}》| 字数:${content.length} | 摘要:${c.ai_summary || content.slice(0, 150)}`;
  }).join('\n');

  const focusLabels: Record<string, string> = {
    retention: '读者留存率预测', dropoff: '流失卡点检测', engagement: '互动参与度', all: '全面分析',
  };

  const prompt = `请分析以下小说章节的读者留存情况，重点：${focusLabels[focus]}

${chapterAnalysis}

以JSON格式返回：{
  "overall_retention": {"score": 82, "trend": "rising/stable/declining"},
  "chapter_analysis": [{
    "chapter": 1,
    "title": "章节标题",
    "retention_score": 85,
    "dropoff_risk": "low/medium/high/critical",
    "risk_factors": ["风险因素"],
    "hook_quality": 80,
    "cliffhanger_strength": 75,
    "suggestions": ["改进建议"]
  }],
  "critical_dropoff_points": [{"chapter": 5, "risk": "high", "reason": "原因"}],
  "engagement_peaks": [{"chapter": 3, "reason": "高潮章节"}],
  "recommendations": ["总体建议"]
}`;

  try {
    const response = await completeChat(
      [{ role: 'system', content: skill?.systemPrompt || '你是一位网文数据分析师。' }, { role: 'user', content: prompt }],
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
