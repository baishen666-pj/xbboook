import { Router } from 'express';
import { z } from 'zod';
import { buildPrompt, toMessages } from '../ai/promptBuilder.js';
import { getSkill } from '../ai/writingSkills.js';
import { getProvider } from '../ai/providers.js';
import { getConfig } from '../ai/configStore.js';
import { validate } from '../middleware/validate.js';

const router = Router({ mergeParams: true });

const STYLE_OPTIONS = ['文学化', '口语化', '精简', '热血', '唯美', '幽默', '悬疑', '严肃'] as const;

const polishSchema = z.object({
  text: z.string().min(10).max(10000),
  style: z.enum(STYLE_OPTIONS),
  customInstruction: z.string().max(1000).optional(),
});

router.post('/polish', validate(polishSchema), async (req, res) => {
  const { text, style, customInstruction } = req.body;

  const skill = getSkill('multi-polish');
  if (!skill) {
    return res.status(500).json({ success: false, error: '技能不存在' });
  }

  const userMessage = `请将以下文本以「${style}」风格进行润色：

${text}
${customInstruction ? `\n额外要求：${customInstruction}` : ''}`;

  try {
    const config = getConfig();
    const prompt = buildPrompt({
      skillId: 'multi-polish',
      sources: [],
      userMessage,
      customInstruction,
    });

    const provider = getProvider(config.provider);
    const messages = toMessages(prompt, [], skill.maxTokens);
    const result = await provider.chat(messages, {
      model: config.model,
      temperature: skill.temperature,
      maxTokens: skill.maxTokens,
    });

    let parsed;
    try {
      const jsonStr = result.content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsed = JSON.parse(jsonStr);
    } catch {
      return res.json({ success: false, error: 'AI 返回格式异常', raw: result.content });
    }

    res.json({ success: true, data: { ...parsed, style } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'AI 请求失败';
    res.status(500).json({ success: false, error: message });
  }
});

export default router;
