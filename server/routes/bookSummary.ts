import { Router } from 'express';
import { z } from 'zod';
import { completeChat } from '../ai/agentFactory.js';
import { getSkill } from '../ai/writingSkills.js';
import { validate } from '../middleware/validate.js';
import { chapterRepo } from '../db/repositories/chapterRepo.js';

const router = Router({ mergeParams: true });

const summarySchema = z.object({
  level: z.enum(['brief', 'detailed', 'comprehensive']).default('detailed'),
  chapterIds: z.array(z.string()).optional(),
  focus: z.enum(['plot', 'character', 'worldview', 'all']).default('all'),
});

router.post('/generate', validate(summarySchema), async (req, res) => {
  const skill = getSkill('book-summary');
  const { projectId } = req.params;
  const { level, chapterIds, focus } = req.body;

  const chapters = chapterIds?.length
    ? chapterRepo.findByProject(projectId).filter(c => chapterIds.includes(c.id))
    : chapterRepo.findByProject(projectId);

  const levelLabels: Record<string, string> = { brief: '简要', detailed: '详细', comprehensive: '全面' };
  const focusLabels: Record<string, string> = { plot: '剧情', character: '角色', worldview: '世界观', all: '全面' };

  const chapterData = chapters.map((c, i) => {
    const content = c.content || '';
    return { index: i + 1, title: c.title, wordCount: content.length, summary: c.ai_summary || content.slice(0, 200) };
  });

  const prompt = `请对以下小说进行${levelLabels[level]}${focusLabels[focus]}摘要：
全书${chapters.length}章，总字数约${chapterData.reduce((s, c) => s + c.wordCount, 0)}字。

${chapterData.slice(0, 40).map(c => `第${c.index}章 ${c.title}(${c.wordCount}字)：${c.summary}`).join('\n')}

以JSON格式返回：{
  "book_summary": "全书摘要（${level === 'brief' ? '200' : level === 'detailed' ? '500' : '1000'}字）",
  "volume_summaries": [{"range": "第1-10章", "summary": "卷摘要", "key_events": ["事件1"]}],
  "character_arcs": [{"name": "角色名", "arc": "角色发展线"}],
  "worldview_changes": ["世界观演变1"],
  "plot_threads": [{"thread": "线索名", "status": "open/resolved", "chapters": [1, 5]}],
  "timeline_gaps": ["时间线缺失1"],
  "coherence_score": 85
}`;

  try {
    const response = await completeChat(
      [{ role: 'system', content: skill?.systemPrompt || '你是专业的内容摘要分析师。' }, { role: 'user', content: prompt }],
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
