import { Router } from 'express';
import { z } from 'zod';
import { completeChat } from '../ai/agentFactory.js';
import { getSkill } from '../ai/writingSkills.js';
import { validate } from '../middleware/validate.js';
import { chapterRepo } from '../db/repositories/chapterRepo.js';

const router = Router({ mergeParams: true });

const journeySchema = z.object({
  chapterIds: z.array(z.string()).optional(),
  emotions: z.array(z.enum(['tension', 'joy', 'sadness', 'anger', 'fear', 'surprise', 'anticipation', 'trust'])).default(['tension', 'joy', 'sadness', 'anticipation']),
});

router.post('/map', validate(journeySchema), async (req, res) => {
  const skill = getSkill('emotion-journey');
  const { projectId } = req.params;
  const { chapterIds, emotions } = req.body;

  const chapters = chapterIds?.length
    ? chapterRepo.findByProject(projectId).filter(c => chapterIds.includes(c.id))
    : chapterRepo.findByProject(projectId);

  const chapterInfo = chapters.slice(0, 25).map((c, i) => {
    const content = c.content || '';
    return `第${i + 1}章《${c.title}》| 摘要:${c.ai_summary || content.slice(0, 200)}`;
  }).join('\n');

  const emotionLabels: Record<string, string> = {
    tension: '紧张', joy: '喜悦', sadness: '悲伤', anger: '愤怒',
    fear: '恐惧', surprise: '惊讶', anticipation: '期待', trust: '信任',
  };

  const prompt = `请映射以下小说的读者情感旅程。

章节信息：
${chapterInfo}

分析的情感维度：${emotions.map(e => emotionLabels[e]).join('、')}

以JSON格式返回：
{
  "journey_data": [${chapters.slice(0, 25).map((_, i) => `{
    "chapter": ${i + 1},
    "title": "章节标题",
    "dominant_emotion": "tension",
    "emotions": {${emotions.map(e => `"${e}": ${Math.floor(Math.random() * 80) + 10}`).join(', ')}},
    "emotional_peak": "本章节的情感高峰描述",
    "transition_type": "上升/下降/平稳/反转"
  }`).join(',')}],
  "emotional_arc": {
    "pattern": "上升-高潮-回落-再起",
    "effectiveness": 78,
    "monotony_risk": "low/medium/high",
    "emotional_range": "宽/窄/适中"
  },
  "weak_spots": [{"chapter": 5, "issue": "情感平淡", "suggestion": "建议添加情感元素"}],
  "power_moments": [{"chapter": 8, "emotion": "joy", "intensity": 90, "technique": "情感爆发技巧"}],
  "optimization": {
    "emotional_diversity_score": 72,
    "transition_smoothness": 80,
    "peak_valley_ratio": "3:2",
    "suggestions": ["情感设计优化建议"]
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

export default router;
