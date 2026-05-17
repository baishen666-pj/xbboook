import { Router } from 'express';
import { z } from 'zod';
import { completeChat } from '../ai/agentFactory.js';
import { getSkill } from '../ai/writingSkills.js';
import { validate } from '../middleware/validate.js';
import { chapterRepo } from '../db/repositories/chapterRepo.js';

const router = Router({ mergeParams: true });

const analyzeSchema = z.object({
  structure: z.enum(['three-act', 'five-act', 'hero-journey', 'save-the-cat', 'custom']).default('three-act'),
  chapters: z.array(z.string()).optional(),
});

const pacingSchema = z.object({
  chapterIds: z.array(z.string()).optional(),
  windowSize: z.number().min(1).max(10).default(3),
});

router.post('/analyze', validate(analyzeSchema), async (req, res) => {
  const skill = getSkill('story-architecture');
  const { projectId } = req.params;
  const { structure, chapters: chapterIds } = req.body;

  const allChapters = chapterRepo.findByProject(projectId);
  const chapters = chapterIds?.length
    ? allChapters.filter(c => chapterIds.includes(c.id))
    : allChapters;

  const summaries = chapters.slice(0, 30).map((c, i) => `第${i + 1}章 ${c.title}：${(c.ai_summary || (c.content || '').slice(0, 200))}`).join('\n');

  const structureNames: Record<string, string> = {
    'three-act': '三幕结构', 'five-act': '五幕结构', 'hero-journey': '英雄之旅',
    'save-the-cat': '救猫咪', 'custom': '自定义结构',
  };

  const prompt = `请用${structureNames[structure]}分析以下小说章节的结构：
${summaries}

以JSON格式返回：{
  "structure": {
    "name": "结构名称",
    "acts": [{
      "name": "幕名",
      "chapters": [1, 5],
      "summary": "该幕概要",
      "key_events": ["关键事件1"],
      "pacing": "fast/medium/slow",
      "completeness": 85
    }]
  },
  "pacing_curve": [{"chapter": 1, "intensity": 70}],
  "suggestions": ["改进建议1"],
  "overall_score": 80
}`;

  try {
    const response = await completeChat(
      [{ role: 'system', content: skill?.systemPrompt || '你是专业的故事结构分析师。' }, { role: 'user', content: prompt }],
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

router.post('/pacing', validate(pacingSchema), async (req, res) => {
  const skill = getSkill('story-architecture');
  const { projectId } = req.params;
  const { chapterIds, windowSize } = req.body;

  const chapters = chapterIds?.length
    ? chapterRepo.findByProject(projectId).filter(c => chapterIds.includes(c.id))
    : chapterRepo.findByProject(projectId);

  const pacingData = chapters.map((c, i) => {
    const content = c.content || '';
    const dialogueRatio = (content.match(/["「"]/g) || []).length / Math.max(content.length, 1) * 100;
    const actionWords = ['打', '杀', '冲', '逃', '追', '战', '攻', '挡', '破', '爆', '怒', '惊', '险', '危'].reduce((acc, w) => acc + (content.split(w).length - 1), 0);
    const emotionWords = ['泪', '哭', '笑', '爱', '恨', '悲', '喜', '怒', '惧', '忧', '愁', '甜'].reduce((acc, w) => acc + (content.split(w).length - 1), 0);
    const intensity = Math.min(100, Math.round(dialogueRatio * 0.3 + actionWords * 3 + emotionWords * 2 + content.length / 100));
    return { chapter: i + 1, title: c.title, wordCount: content.length, intensity, dialogueRatio: Math.round(dialogueRatio), actionDensity: actionWords, emotionDensity: emotionWords };
  });

  const smoothedPacing = pacingData.map((point, i) => {
    const start = Math.max(0, i - Math.floor(windowSize / 2));
    const end = Math.min(pacingData.length, i + Math.ceil(windowSize / 2));
    const window = pacingData.slice(start, end);
    const smoothedIntensity = Math.round(window.reduce((s, p) => s + p.intensity, 0) / window.length);
    return { ...point, smoothedIntensity };
  });

  res.json({ success: true, data: { pacing: smoothedPacing, totalChapters: chapters.length } });
});

export default router;
