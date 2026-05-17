import { Router } from 'express';
import { z } from 'zod';
import { completeChat } from '../ai/agentFactory.js';
import { getSkill } from '../ai/writingSkills.js';
import { validate } from '../middleware/validate.js';

const router = Router({ mergeParams: true });

const translateSchema = z.object({
  text: z.string().min(10, '文本至少 10 字').max(10000, '文本最多 10000 字'),
  targetLang: z.string().min(1, 'targetLang 必填'),
  style: z.enum(['literal', 'free', 'localized']).default('localized'),
});

router.post('/translate', validate(translateSchema), async (req, res) => {
  const { text, targetLang, style } = req.body;

  try {
    const skill = getSkill('translation');
    const systemPrompt = skill?.systemPrompt || '你是一位专业的文学翻译家，精通多种语言之间的互译。';

    const styleLabel = style === 'literal' ? '直译'
      : style === 'free' ? '意译'
      : '本地化';

    const userMessage = `将以下中文文本翻译为${targetLang}，翻译风格：${styleLabel}：

${text}

以JSON格式返回：{ "translated": "翻译结果", "notes": "翻译说明", "confidence": 90 }`;

    const response = await completeChat(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      { temperature: skill?.temperature ?? 0.3, maxTokens: skill?.maxTokens ?? 4000 },
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

    res.json({
      success: true,
      data: {
        translated: parsed.translated || '',
        notes: parsed.notes || '',
        confidence: parsed.confidence || 0,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'AI 请求失败';
    res.status(500).json({ success: false, error: message });
  }
});

export default router;
