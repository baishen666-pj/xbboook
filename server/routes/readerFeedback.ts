import { Router } from 'express';
import { z } from 'zod';
import { completeChat } from '../ai/agentFactory.js';
import { getSkill } from '../ai/writingSkills.js';
import { validate } from '../middleware/validate.js';

const router = Router({ mergeParams: true });

const VALID_READER_TYPES = ['casual', 'hardcore', 'critic', 'shipper', 'newbie'] as const;

const simulateSchema = z.object({
  text: z.string().min(100, '文本至少 100 字').max(20000, '文本最多 20000 字'),
  readerTypes: z.array(z.enum(VALID_READER_TYPES)).min(1, '至少选择 1 种读者类型').max(5, '最多选择 5 种读者类型'),
});

router.post('/simulate', validate(simulateSchema), async (req, res) => {
  const { text, readerTypes } = req.body;

  try {
    const skill = getSkill('reader-feedback');
    const systemPrompt = skill?.systemPrompt || '你是一位善于换位思考的文学评论家，能够从不同读者视角分析文本。';

    const readerLabels: Record<string, string> = {
      casual: '休闲读者',
      hardcore: '资深读者',
      critic: '评论家',
      shipper: 'CP粉',
      newbie: '新手读者',
    };

    const typeLabels = readerTypes.map((t: string) => readerLabels[t] || t).join('、');

    const userMessage = `请模拟以下类型的读者对这段文本的反馈：${typeLabels}

文本：
${text}

以JSON格式返回：{ "feedbacks": [{ "readerType": "读者类型", "reaction": "第一反应", "score": 85, "comment": "详细评论", "suggestions": ["建议1"] }] }`;

    const response = await completeChat(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      { temperature: skill?.temperature ?? 0.7, maxTokens: skill?.maxTokens ?? 3000 },
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

    if (!Array.isArray(parsed.feedbacks)) {
      return res.json({ success: false, error: 'AI 返回格式异常：缺少 feedbacks 数组' });
    }

    res.json({ success: true, data: { feedbacks: parsed.feedbacks } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'AI 请求失败';
    res.status(500).json({ success: false, error: message });
  }
});

export default router;
