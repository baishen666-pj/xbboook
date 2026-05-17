import { Router } from 'express';
import { z } from 'zod';
import * as characterRepo from '../db/repositories/characterRepo.js';
import { buildPrompt, toMessages } from '../ai/promptBuilder.js';
import { getSkill } from '../ai/writingSkills.js';
import { getProvider } from '../ai/providers.js';
import { getConfig } from '../ai/configStore.js';
import { validate } from '../middleware/validate.js';

const router = Router({ mergeParams: true });

const dialogueSchema = z.object({
  characterIds: z.array(z.string().min(1)).min(2).max(6),
  scene: z.string().min(1).max(1000),
  mood: z.string().max(50).optional(),
  customInstruction: z.string().max(2000).optional(),
});

router.post('/simulate', validate(dialogueSchema), async (req, res) => {
  const { projectId } = req.params;
  const { characterIds, scene, mood, customInstruction } = req.body;

  const characters = characterIds
    .map((id: string) => characterRepo.findById(id))
    .filter(Boolean);

  if (characters.length < 2) {
    return res.status(404).json({ success: false, error: '至少需要2个有效角色' });
  }

  const relations = characterRepo.findRelations(projectId);
  const relevantRelations = relations.filter(
    (r) => characterIds.includes(r.character_a_id) && characterIds.includes(r.character_b_id)
  );

  const skill = getSkill('character-dialogue');
  if (!skill) {
    return res.status(500).json({ success: false, error: '技能不存在' });
  }

  const charDescs = characters.map((c: any) =>
    `${c.name}${c.nickname ? `（${c.nickname}）` : ''}：${c.personality || '性格未设定'}${c.background ? `；背景：${c.background}` : ''}${c.speech_style ? `；说话风格：${c.speech_style}` : ''}`
  ).join('\n');

  const relDescs = relevantRelations.length > 0
    ? relevantRelations.map((r: any) =>
        `${characters.find((c: any) => c.id === r.character_a_id)?.name ?? '?'} ↔ ${characters.find((c: any) => c.id === r.character_b_id)?.name ?? '?'}：${r.relation_type}${r.description ? `（${r.description}）` : ''}`
      ).join('\n')
    : '无明确关系设定';

  const userMessage = `请模拟以下角色在这个场景中的对话：

【角色】
${charDescs}

【角色关系】
${relDescs}

【场景】
${scene}
${mood ? `\n【氛围】${mood}` : ''}
${customInstruction ? `\n【额外要求】${customInstruction}` : ''}`;

  try {
    const config = getConfig();
    const prompt = buildPrompt({
      skillId: 'character-dialogue',
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

    res.json({ success: true, data: parsed });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'AI 请求失败';
    res.status(500).json({ success: false, error: message });
  }
});

export default router;
