import { Router } from 'express';
import { z } from 'zod';
import { completeChat } from '../ai/agentFactory.js';
import { getSkill } from '../ai/writingSkills.js';
import { validate } from '../middleware/validate.js';

const router = Router({ mergeParams: true });

const generateSchema = z.object({
  category: z.enum(['character', 'location', 'technique', 'faction']),
  context: z.string().min(1, 'context 必填').max(2000, 'context 最多 2000 字'),
  count: z.number().int().min(1).max(10).default(5),
  gender: z.string().optional(),
  race: z.string().optional(),
});

router.post('/generate', validate(generateSchema), async (req, res) => {
  const { category, context, count, gender, race } = req.body;

  try {
    const skill = getSkill('name-generator');
    const systemPrompt = skill?.systemPrompt || '你是一位精通各种文学命名惯例的创意命名专家。';

    const categoryLabel = category === 'character' ? '角色'
      : category === 'location' ? '地名'
      : category === 'technique' ? '功法'
      : '势力';

    const extras: string[] = [];
    if (gender) extras.push(`性别：${gender}`);
    if (race) extras.push(`种族：${race}`);

    const userMessage = `根据以下信息生成${count}个${categoryLabel}名称：
背景：${context}
${extras.join('\n')}

以JSON格式返回：{ "names": [{ "name": "名称", "meaning": "含义", "style": "风格描述" }] }`;

    const response = await completeChat(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      { temperature: skill?.temperature ?? 0.9, maxTokens: skill?.maxTokens ?? 2000 },
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

    if (!Array.isArray(parsed.names)) {
      return res.json({ success: false, error: 'AI 返回格式异常：缺少 names 数组' });
    }

    res.json({ success: true, data: { names: parsed.names } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'AI 请求失败';
    res.status(500).json({ success: false, error: message });
  }
});

export default router;
