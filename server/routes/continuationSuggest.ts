import { Router } from 'express';
import { z } from 'zod';
import { completeChat } from '../ai/agentFactory.js';
import { getSkill } from '../ai/writingSkills.js';
import { validate } from '../middleware/validate.js';

const router = Router({ mergeParams: true });

const continuationSchema = z.object({
  text: z.string().min(50, '文本至少 50 字').max(10000, '文本最多 10000 字'),
  numSuggestions: z.number().int().min(2).max(5).default(3),
});

router.post('/suggest', validate(continuationSchema), async (req, res) => {
  const { text, numSuggestions } = req.body;

  try {
    const skill = getSkill('continuation-suggest');
    const systemPrompt = skill?.systemPrompt || '你是一位经验丰富的网文作者，请根据前文生成续写建议。';

    const userMessage = `基于以下文本，生成${numSuggestions}个不同方向的续写建议：

${text}

请以JSON格式返回：{ "suggestions": [{ "direction": "方向名称", "content": "续写内容(200字以内)", "confidence": 85 }] }`;

    const response = await completeChat(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      { temperature: skill?.temperature ?? 0.8, maxTokens: skill?.maxTokens ?? 3000 },
    );

    let parsed;
    try {
      const jsonStr = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsed = JSON.parse(jsonStr);
    } catch {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return res.json({ success: false, error: 'AI 返回格式异常', raw: response });
      }
      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch {
        return res.json({ success: false, error: 'AI 返回格式异常', raw: response });
      }
    }

    if (!Array.isArray(parsed.suggestions)) {
      return res.json({ success: false, error: 'AI 返回格式异常：缺少 suggestions 数组' });
    }

    res.json({ success: true, data: { suggestions: parsed.suggestions } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'AI 请求失败';
    res.status(500).json({ success: false, error: message });
  }
});

export default router;
