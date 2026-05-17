import { Router } from 'express';
import { z } from 'zod';
import * as characterRepo from '../db/repositories/characterRepo.js';
import { buildPrompt, toMessages } from '../ai/promptBuilder.js';
import { getSkill } from '../ai/writingSkills.js';
import { getProvider } from '../ai/providers.js';
import { getConfig } from '../ai/configStore.js';
import { validate } from '../middleware/validate.js';

const router = Router({ mergeParams: true });

const voiceSchema = z.object({
  characterId: z.string().min(1),
  text: z.string().min(10).max(5000),
  customInstruction: z.string().max(1000).optional(),
});

// Rewrite text in character's voice
router.post('/rewrite', validate(voiceSchema), async (req, res) => {
  const { projectId } = req.params;
  const { characterId, text, customInstruction } = req.body;

  const character = characterRepo.findById(characterId);
  if (!character || character.project_id !== projectId) {
    return res.status(404).json({ success: false, error: '角色不存在' });
  }

  const skill = getSkill('dialogue');
  if (!skill) {
    return res.status(500).json({ success: false, error: '技能不存在' });
  }

  const voiceParts: string[] = [];
  if (character.speech_style) voiceParts.push(`说话风格：${character.speech_style}`);
  if (character.verbal_tics) voiceParts.push(`口头禅：${character.verbal_tics}`);
  if (character.vocabulary_level) voiceParts.push(`用词水平：${character.vocabulary_level}`);
  if (character.sentence_length_pref) voiceParts.push(`句子偏好：${character.sentence_length_pref}`);
  if (character.emotional_expressiveness) voiceParts.push(`情感表达：${character.emotional_expressiveness}`);
  if (character.personality) voiceParts.push(`性格：${character.personality}`);

  const voiceDesc = voiceParts.length > 0
    ? voiceParts.join('\n')
    : `性格：${character.personality || '未设定'}`;

  const userMessage = `请将以下文本改写为角色「${character.name}」的语言风格。

【角色语音特征】
${voiceDesc}

【原始文本】
${text}

要求：
- 严格遵循角色的说话方式
- 保持原文核心含义
- 输出JSON：
{
  "rewritten": "风格化后的文本",
  "voice_traits": ["使用的语音特征1", "使用的语音特征2"],
  "match_score": 85
}
${customInstruction ? `\n额外要求：${customInstruction}` : ''}`;

  try {
    const config = getConfig();
    const prompt = buildPrompt({ skillId: 'dialogue', sources: [], userMessage, customInstruction });
    const provider = getProvider(config.provider);
    const messages = toMessages(prompt, [], skill.maxTokens);
    const result = await provider.chat(messages, {
      model: config.model, temperature: skill.temperature, maxTokens: skill.maxTokens,
    });

    let parsed;
    try {
      const jsonStr = result.content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsed = JSON.parse(jsonStr);
    } catch {
      return res.json({ success: false, error: 'AI 返回格式异常', raw: result.content });
    }

    res.json({ success: true, data: { ...parsed, characterName: character.name } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'AI 请求失败';
    res.status(500).json({ success: false, error: message });
  }
});

export default router;
