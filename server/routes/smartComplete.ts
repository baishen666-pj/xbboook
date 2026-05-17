import { Router } from 'express';
import { z } from 'zod';
import { buildPrompt, toMessages } from '../ai/promptBuilder.js';
import { getSkill } from '../ai/writingSkills.js';
import { getProvider } from '../ai/providers.js';
import { getConfig } from '../ai/configStore.js';
import { validate } from '../middleware/validate.js';

const router = Router({ mergeParams: true });

const completeSchema = z.object({
  text: z.string().min(20).max(15000),
  direction: z.enum(['continue', 'dialogue', 'action', 'description', 'emotion']).optional(),
  maxWords: z.number().int().min(50).max(1000).optional(),
  customInstruction: z.string().max(1000).optional(),
});

const DIRECTION_PROMPTS: Record<string, string> = {
  continue: '请自然地续写接下来的段落',
  dialogue: '请续写一段对话',
  action: '请续写一段动作/战斗场景',
  description: '请续写一段环境或人物描写',
  emotion: '请续写角色的内心活动和情感',
};

router.post('/complete', validate(completeSchema), async (req, res) => {
  const { text, direction = 'continue', maxWords = 300, customInstruction } = req.body;

  const skill = getSkill('continue');
  if (!skill) {
    return res.status(500).json({ success: false, error: '技能不存在' });
  }

  const directionPrompt = DIRECTION_PROMPTS[direction] || DIRECTION_PROMPTS.continue;

  const userMessage = `${directionPrompt}，约${maxWords}字。

以下是需要续写的前文：

${text}
${customInstruction ? `\n额外要求：${customInstruction}` : ''}`;

  try {
    const config = getConfig();
    const prompt = buildPrompt({
      skillId: 'continue',
      sources: [],
      userMessage,
      customInstruction,
    });

    const provider = getProvider(config.provider);
    const messages = toMessages(prompt, [], skill.maxTokens);
    const result = await provider.chat(messages, {
      model: config.model,
      temperature: skill.temperature,
      maxTokens: Math.min(maxWords * 2, skill.maxTokens),
    });

    res.json({ success: true, data: { completion: result.content, direction } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'AI 请求失败';
    res.status(500).json({ success: false, error: message });
  }
});

export default router;
