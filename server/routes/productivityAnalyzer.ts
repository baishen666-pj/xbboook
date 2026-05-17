import { Router } from 'express';
import { z } from 'zod';
import { completeChat } from '../ai/agentFactory.js';
import { getSkill } from '../ai/writingSkills.js';
import { validate } from '../middleware/validate.js';
import { chapterRepo } from '../db/repositories/chapterRepo.js';
import { statsRepo } from '../db/repositories/statsRepo.js';

const router = Router({ mergeParams: true });

const analyzeSchema = z.object({
  period: z.enum(['week', 'month', 'quarter', 'all']).default('month'),
});

router.post('/analyze', validate(analyzeSchema), async (req, res) => {
  const skill = getSkill('productivity-analyzer');
  const { projectId } = req.params;
  const { period } = req.body;

  const chapters = chapterRepo.findByProject(projectId);
  const totalWords = chapters.reduce((sum, c) => sum + (c.content?.length || 0), 0);
  const totalChapters = chapters.length;

  const chapterStats = chapters.slice(-20).map((c, i) => {
    const content = c.content || '';
    return {
      chapter: i + 1,
      title: c.title,
      words: content.length,
      created: c.created_at,
      updated: c.updated_at,
    };
  });

  const summary = statsRepo.getSummary(projectId);

  const prompt = `请基于以下写作数据，综合分析写作效率和习惯。

项目统计：
- 总章节数：${totalChapters}
- 总字数：${totalWords}
- 分析周期：${period}
- 累计写作天数：${summary.totalDays}
- 日均字数：${summary.avgDaily}
- 最近章节：${JSON.stringify(chapterStats.slice(-10))}

以JSON格式返回：
{
  "overview": {
    "total_words": ${totalWords},
    "total_chapters": ${totalChapters},
    "avg_words_per_chapter": ${Math.round(totalWords / Math.max(totalChapters, 1))},
    "productivity_level": "high/medium/low",
    "completion_rate": 75
  },
  "patterns": {
    "peak_hours": [{"hour": 20, "productivity": 90}],
    "best_day": "周三",
    "avg_session_length": "2小时",
    "words_per_session": 1500,
    "consistency_score": 70
  },
  "bottlenecks": [{
    "type": "starting_block/middle_slump/revision_loop/perfectionism",
    "description": "瓶颈描述",
    "evidence": "数据证据",
    "solution": "解决方案"
  }],
  "heatmap_data": [${Array.from({ length: 7 }, (_, d) =>
    Array.from({ length: 6 }, (_, h) => `{"day": ${d}, "period": ${h}, "score": ${Math.floor(Math.random() * 100)}}`)
  ).flat().join(',')}],
  "weekly_trend": [${Array.from({ length: 12 }, (_, i) => `{"week": ${i + 1}, "words": ${Math.floor(Math.random() * 3000) + 500}}`).join(',')}],
  "recommendations": [{
    "category": "habits/technique/tools/mindset",
    "title": "建议标题",
    "description": "建议描述",
    "priority": "high/medium/low",
    "action": "具体行动"
  }],
  "goals": {
    "daily_target": 2000,
    "weekly_target": 10000,
    "milestone": "下一个里程碑",
    "eta": "预计达成时间"
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
