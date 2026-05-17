import { Router } from 'express';
import { z } from 'zod';
import * as chapterRepo from '../db/repositories/chapterRepo.js';
import * as characterRepo from '../db/repositories/characterRepo.js';
import { readChapter } from '../services/fileService.js';
import { buildPrompt, toMessages } from '../ai/promptBuilder.js';
import { getSkill } from '../ai/writingSkills.js';
import { getProvider } from '../ai/providers.js';
import { getConfig } from '../ai/configStore.js';
import { validate } from '../middleware/validate.js';

const router = Router({ mergeParams: true });

const checkSchema = z.object({
  customInstruction: z.string().max(2000).optional(),
});

interface ConsistencyIssue {
  type: string;
  severity: string;
  location: string;
  description: string;
  suggestion: string;
}

// Run consistency check across all chapters
router.post('/check', validate(checkSchema), async (req, res) => {
  const { projectId } = req.params;
  const { customInstruction } = req.body;

  const chapters = chapterRepo.findByProject(projectId);
  const characters = characterRepo.findByProject(projectId);

  if (chapters.length === 0) {
    return res.json({ success: true, data: { issues: [], summary: '暂无章节可检查' } });
  }

  const charDescs = characters.slice(0, 15).map((c: any) =>
    `${c.name}${c.gender ? `(${c.gender})` : ''}${c.age ? ` 年龄:${c.age}` : ''}${c.personality ? ` 性格:${c.personality.slice(0, 50)}` : ''}${c.appearance ? ` 外貌:${c.appearance.slice(0, 50)}` : ''}`
  ).join('\n');

  // Sample up to 5 chapters for analysis
  const sampleChapters = chapters.slice(0, 5);
  const chapterTexts: string[] = [];

  for (const ch of sampleChapters) {
    const content = await readChapter(projectId, ch.id);
    const plainText = content.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    if (plainText) {
      chapterTexts.push(`【${ch.title}】\n${plainText.slice(0, 1500)}`);
    }
  }

  const skill = getSkill('outline-analysis');
  if (!skill) {
    return res.status(500).json({ success: false, error: '技能不存在' });
  }

  const userMessage = `请检查以下小说内容的一致性问题：

【角色设定】
${charDescs || '（无角色设定）'}

【章节内容采样】
${chapterTexts.join('\n\n')}

请检查以下类型的一致性问题：
1. 时间线矛盾（角色出现在不该出现的地方、时间顺序错误）
2. 角色前后不一致（性格突变、名字错误、外貌描述矛盾）
3. 地理/空间错误（距离不合理、场景描述矛盾）
4. 设定矛盾（能力体系、世界观规则冲突）
5. 称谓不一致（同一个角色被叫不同名字）

输出JSON格式：
{
  "issues": [
    {
      "type": "timeline|character|geography|setting|naming",
      "severity": "error|warning",
      "location": "第X章",
      "description": "问题描述",
      "suggestion": "修改建议"
    }
  ],
  "summary": "总体评价",
  "consistency_score": 85
}
${customInstruction ? `\n额外要求：${customInstruction}` : ''}`;

  try {
    const config = getConfig();
    const prompt = buildPrompt({ skillId: 'outline-analysis', sources: [], userMessage, customInstruction });
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
