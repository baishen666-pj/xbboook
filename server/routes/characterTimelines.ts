import { Router } from 'express';
import { z } from 'zod';
import * as characterTimelineRepo from '../db/repositories/characterTimelineRepo.js';
import * as characterRepo from '../db/repositories/characterRepo.js';
import { buildPrompt, toMessages } from '../ai/promptBuilder.js';
import { getSkill } from '../ai/writingSkills.js';
import { getProvider } from '../ai/providers.js';
import { getConfig } from '../ai/configStore.js';
import { validate } from '../middleware/validate.js';

const router = Router({ mergeParams: true });

const createSchema = z.object({
  characterId: z.string().min(1),
  eventTitle: z.string().min(1).max(200),
  chapterId: z.string().optional(),
  eventDescription: z.string().max(2000).optional(),
  storyTime: z.string().max(100).optional(),
});

const updateSchema = z.object({
  eventTitle: z.string().min(1).max(200).optional(),
  chapterId: z.string().nullable().optional(),
  eventDescription: z.string().max(2000).optional(),
  storyTime: z.string().max(100).optional(),
});

// List timeline events for a character or project
router.get('/', (req, res) => {
  const { projectId } = req.params;
  const characterId = req.query.characterId as string | undefined;

  const events = characterId
    ? characterTimelineRepo.findByCharacter(characterId)
    : characterTimelineRepo.findByProject(projectId);

  res.json({ success: true, data: events });
});

// Create timeline event
router.post('/', validate(createSchema), (req, res) => {
  const { projectId } = req.params;
  const { characterId, eventTitle, chapterId, eventDescription, storyTime } = req.body;

  const character = characterRepo.findById(characterId);
  if (!character || character.project_id !== projectId) {
    return res.status(404).json({ success: false, error: '角色不存在' });
  }

  const event = characterTimelineRepo.create({
    projectId,
    characterId,
    eventTitle,
    chapterId,
    eventDescription,
    storyTime,
  });

  res.status(201).json({ success: true, data: event });
});

// Update timeline event
router.patch('/:eventId', validate(updateSchema), (req, res) => {
  const { eventId } = req.params;
  const { chapterId, eventTitle, eventDescription, storyTime, ...rest } = req.body;

  const data: Record<string, unknown> = { ...rest };
  if (chapterId !== undefined) data.chapter_id = chapterId;
  if (eventTitle !== undefined) data.event_title = eventTitle;
  if (eventDescription !== undefined) data.event_description = eventDescription;
  if (storyTime !== undefined) data.story_time = storyTime;

  const updated = characterTimelineRepo.update(eventId, data);
  if (!updated) {
    return res.status(404).json({ success: false, error: '事件不存在' });
  }
  res.json({ success: true, data: updated });
});

// Delete timeline event
router.delete('/:eventId', (req, res) => {
  const deleted = characterTimelineRepo.deleteById(req.params.eventId);
  if (!deleted) {
    return res.status(404).json({ success: false, error: '事件不存在' });
  }
  res.json({ success: true, data: null });
});

// AI detect timeline conflicts
router.post('/detect-conflicts', async (req, res) => {
  const { projectId } = req.params;
  const events = characterTimelineRepo.findByProject(projectId);

  if (events.length === 0) {
    return res.json({ success: true, data: { conflicts: [], message: '暂无时间线事件' } });
  }

  const characters = characterRepo.findByProject(projectId);
  const charMap = new Map(characters.map((c: any) => [c.id, c.name]));

  // Group events by character
  const byChar = new Map<string, typeof events>();
  for (const ev of events) {
    const list = byChar.get(ev.character_id) || [];
    list.push(ev);
    byChar.set(ev.character_id, list);
  }

  const timelineText = [...byChar.entries()].map(([charId, evts]) => {
    const name = charMap.get(charId) || '未知角色';
    const lines = evts.map((e) =>
      `  ${e.story_time || '未指定时间'}: ${e.event_title}${e.event_description ? ` — ${e.event_description.slice(0, 60)}` : ''}`
    ).join('\n');
    return `【${name}】\n${lines}`;
  }).join('\n\n');

  const skill = getSkill('outline-analysis');
  if (!skill) {
    return res.status(500).json({ success: false, error: '技能不存在' });
  }

  const userMessage = `请分析以下角色时间线是否存在冲突：

${timelineText}

检查要点：
1. 同一角色在不同地点同时出现
2. 时间顺序矛盾（后面的故事时间早于前面）
3. 角色在死亡后仍出现
4. 角色之间的交互时间不匹配

输出JSON格式：
{
  "conflicts": [
    {"characters": ["角色A","角色B"], "description": "冲突描述", "severity": "error|warning"}
  ],
  "summary": "总体评价"
}`;

  try {
    const config = getConfig();
    const prompt = buildPrompt({ skillId: 'outline-analysis', sources: [], userMessage });
    const provider = getProvider(config.provider);
    const messages = toMessages(prompt, [], skill.maxTokens);
    const result = await provider.chat(messages, {
      model: config.model, temperature: 0.3, maxTokens: skill.maxTokens,
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
