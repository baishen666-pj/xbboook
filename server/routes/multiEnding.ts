import { Router } from 'express';
import { z } from 'zod';
import { completeChat } from '../ai/agentFactory.js';
import { getSkill } from '../ai/writingSkills.js';
import { validate } from '../middleware/validate.js';
import { chapterRepo } from '../db/repositories/chapterRepo.js';

const router = Router({ mergeParams: true });

const endingTypes = ['happy', 'tragic', 'open', 'twist', 'bittersweet', 'circular'] as const;

const generateSchema = z.object({
  chapterIds: z.array(z.string()).optional(),
  endingTypes: z.array(z.enum(endingTypes)).default(['happy', 'tragic', 'twist', 'open']),
  characterFocus: z.string().optional(),
  constraints: z.string().optional(),
});

router.post('/generate', validate(generateSchema), async (req, res) => {
  const skill = getSkill('multi-ending');
  const { projectId } = req.params;
  const { chapterIds, endingTypes: types, characterFocus, constraints } = req.body;

  const chapters = chapterIds?.length
    ? chapterRepo.findByProject(projectId).filter(c => chapterIds.includes(c.id))
    : chapterRepo.findByProject(projectId);

  const chapterInfo = chapters.slice(0, 20).map((c, i) => {
    const content = c.content || '';
    return `第${i + 1}章《${c.title}》| 字数:${content.length} | 摘要:${c.ai_summary || content.slice(0, 150)}`;
  }).join('\n');

  const typeLabels: Record<string, string> = {
    happy: '大团圆', tragic: '悲剧', open: '开放式', twist: '反转', bittersweet: '苦甜交织', circular: '循环',
  };

  const prompt = `请根据以下小说的已有剧情，生成${types.length}种不同类型的结局方案。

已完成的章节：
${chapterInfo}

${characterFocus ? `重点关注角色：${characterFocus}` : ''}
${constraints ? `约束条件：${constraints}` : ''}

需要生成的结局类型：${types.map(t => typeLabels[t]).join('、')}

以JSON格式返回：
{
  "story_summary": "当前故事梗概",
  "active_threads": ["未解决的剧情线索"],
  "key_characters": [{"name": "角色名", "current_state": "当前状态", "potential_arcs": ["可能的发展"]}],
  "endings": [${types.map((t, i) => `{
    "id": ${i + 1},
    "type": "${t}",
    "type_name": "${typeLabels[t]}",
    "title": "结局标题",
    "summary": "结局概述（200字以内）",
    "key_events": ["关键事件1", "关键事件2", "关键事件3"],
    "character_fates": [{"name": "角色名", "fate": "结局命运"}],
    "emotional_impact": "情感冲击描述",
    "reader_satisfaction_predicted": 85,
    "plot_threads_resolved": ["解决的线索"],
    "surprise_element": "意外元素",
    "sample_epilogue": "结局片段示例（300字以内）"
  }`).join(',')}],
  "comparison": {
    "best_overall": 1,
    "most_surprising": {"id": 2, "reason": "原因"},
    "most_satisfying": {"id": 1, "reason": "原因"},
    "most_thought_provoking": {"id": 3, "reason": "原因"}
  },
  "recommendation": "综合推荐及理由"
}`;

  try {
    const response = await completeChat(
      [{ role: 'system', content: skill?.systemPrompt || '' }, { role: 'user', content: prompt }],
      { temperature: skill?.temperature ?? 0.9, maxTokens: skill?.maxTokens ?? 5000 },
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
