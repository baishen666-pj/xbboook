import { Router } from 'express';
import { z } from 'zod';
import { completeChat } from '../ai/agentFactory.js';
import { getSkill } from '../ai/writingSkills.js';
import { validate } from '../middleware/validate.js';
import { chapterRepo } from '../db/repositories/chapterRepo.js';

const router = Router({ mergeParams: true });

const generateSchema = z.object({
  fromChapterId: z.string(),
  toChapterId: z.string(),
  transitionType: z.enum(['time_skip', 'scene_shift', 'perspective_switch', 'emotion_turn', 'suspense_bridge', 'auto']).default('auto'),
  length: z.enum(['brief', 'moderate', 'extended']).default('moderate'),
});

router.post('/generate', validate(generateSchema), async (req, res) => {
  const skill = getSkill('chapter-transition');
  const { fromChapterId, toChapterId, transitionType, length } = req.body;

  const fromCh = chapterRepo.findById(fromChapterId);
  const toCh = chapterRepo.findById(toChapterId);
  if (!fromCh || !toCh) return res.status(404).json({ success: false, error: '章节不存在' });

  const fromContent = fromCh.content || '';
  const toContent = toCh.content || '';
  const fromEnding = fromContent.slice(-800);
  const toOpening = toContent.slice(0, 800);

  const typeLabels: Record<string, string> = {
    time_skip: '时间跳跃', scene_shift: '场景转换', perspective_switch: '视角切换',
    emotion_turn: '情绪转折', suspense_bridge: '悬念衔接', auto: '自动判断',
  };
  const lengthMap: Record<string, string> = {
    brief: '简短（100-200字）', moderate: '适中（200-400字）', extended: '详细（400-600字）',
  };

  const prompt = `请为以下两章之间生成过渡段落。

前章《${fromCh.title}》结尾：
${fromEnding}

后章《${toCh.title}》开头：
${toOpening}

过渡类型：${typeLabels[transitionType]}
长度要求：${lengthMap[length]}

以JSON格式返回：
{
  "transition_analysis": {
    "from_mood": "前章结尾氛围",
    "to_mood": "后章开头氛围",
    "gap_type": "时间/空间/情感/信息差",
    "gap_description": "差距描述",
    "recommended_type": "推荐过渡类型"
  },
  "transitions": [{
    "type": "过渡类型",
    "text": "过渡段落文本",
    "word_count": 250,
    "tone": "语调描述",
    "techniques_used": ["使用的技巧"]
  }, {
    "type": "备选类型",
    "text": "备选过渡段落",
    "word_count": 200,
    "tone": "语调描述",
    "techniques_used": ["使用的技巧"]
  }, {
    "type": "第三种类型",
    "text": "第三种过渡段落",
    "word_count": 180,
    "tone": "语调描述",
    "techniques_used": ["使用的技巧"]
  }],
  "tips": ["过渡写作技巧"]
}`;

  try {
    const response = await completeChat(
      [{ role: 'system', content: skill?.systemPrompt || '' }, { role: 'user', content: prompt }],
      { temperature: skill?.temperature ?? 0.8, maxTokens: skill?.maxTokens ?? 4000 },
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
