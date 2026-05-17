import { Router } from 'express';
import { z } from 'zod';
import * as characterRepo from '../db/repositories/characterRepo.js';
import * as worldviewsRepo from '../db/repositories/worldviewRepo.js';
import * as outlineRepo from '../db/repositories/outlineRepo.js';
import { buildPrompt, toMessages } from '../ai/promptBuilder.js';
import { getSkill } from '../ai/writingSkills.js';
import { getProvider } from '../ai/providers.js';
import { getConfig } from '../ai/configStore.js';
import { validate } from '../middleware/validate.js';

const router = Router({ mergeParams: true });

const generateSchema = z.object({
  type: z.enum(['character-cards', 'relationship-map', 'worldview-summary', 'full-bible']),
  characterIds: z.array(z.string()).optional(),
  customInstruction: z.string().max(2000).optional(),
});

router.post('/generate', validate(generateSchema), async (req, res) => {
  const { projectId } = req.params;
  const { type, characterIds, customInstruction } = req.body;

  const characters = characterRepo.findByProject(projectId);
  const worldviews = worldviewsRepo.findByProject(projectId);
  const outlines = outlineRepo.findByProject(projectId);

  if (characters.length === 0 && worldviews.length === 0) {
    return res.json({ success: false, error: '项目尚无角色或世界观设定' });
  }

  const skill = getSkill('outline-analysis');
  if (!skill) {
    return res.status(500).json({ success: false, error: '技能不存在' });
  }

  let userMessage = '';

  if (type === 'character-cards') {
    const targetChars = characterIds?.length
      ? characters.filter((c: any) => characterIds.includes(c.id))
      : characters;

    const charDescs = targetChars.map((c: any) =>
      `【${c.name}】${c.nickname ? `别名:${c.nickname}` : ''}\n性别:${c.gender || '未设定'} 年龄:${c.age || '未设定'}\n性格:${c.personality || '未设定'}\n外貌:${c.appearance || '未设定'}\n背景:${c.background || '未设定'}\n能力:${c.abilities || '未设定'}`
    ).join('\n\n');

    userMessage = `请根据以下角色信息生成完善的人物卡片，补充缺失的设定细节：

${charDescs}

为每个角色输出JSON：
{
  "cards": [
    {
      "name": "角色名",
      "nickname": "别名",
      "gender": "性别",
      "age": "年龄",
      "personality": "完善后的性格描述",
      "appearance": "完善后的外貌描写",
      "background": "完善后的背景故事",
      "abilities": "能力描述",
      "speech_habits": "语言习惯",
      "goals": "核心目标",
      "fears": "恐惧/弱点",
      "relationships": ["与XX: 关系描述"]
    }
  ]
}`;
  } else if (type === 'relationship-map') {
    const charNames = characters.slice(0, 15).map((c: any) => c.name).join('、');
    userMessage = `请分析以下角色之间可能的关系，生成关系图谱：

角色列表：${charNames}

输出JSON：
{
  "relationships": [
    {"from": "角色A", "to": "角色B", "type": "师徒/朋友/敌对/恋人/亲人/上下级", "description": "关系描述", "intensity": "strong|medium|weak"}
  ]
}`;
  } else if (type === 'worldview-summary') {
    const wvText = worldviews.map((w: any) =>
      `【${w.category}/${w.title}】${w.content || '无内容'}`
    ).join('\n\n');

    userMessage = `请整理以下世界观设定，生成一份完整的世界观摘要文档：

${wvText || '（无世界观设定）'}

输出JSON：
{
  "categories": [
    {
      "name": "分类名",
      "items": [{"title": "条目", "summary": "摘要", "details": "详细说明"}]
    }
  ],
  "inconsistencies": ["设定矛盾点"],
  "suggestions": ["完善建议"]
}`;
  } else {
    // full-bible: all of the above combined
    const charDescs = characters.slice(0, 10).map((c: any) =>
      `${c.name}(${c.role_type}): ${c.personality?.slice(0, 50) || '无性格设定'}`
    ).join('、');
    const wvCats = [...new Set(worldviews.map((w: any) => w.category))].join('、');
    const outlineCount = outlines.length;

    userMessage = `请为这部小说生成一份设定圣经（Story Bible），包含以下内容：

角色概况：${charDescs}
世界观分类：${wvCats || '无'}
大纲节点数：${outlineCount}

输出JSON：
{
  "title": "作品设定圣经",
  "world_rules": ["核心世界规则1", "核心世界规则2"],
  "power_system": "力量体系描述",
  "geography": "地理设定摘要",
  "key_characters": [{"name": "名字", "role": "定位", "arc": "角色弧线"}],
  "timeline": "时间线摘要",
  "themes": ["核心主题1", "核心主题2"],
  "rules_to_remember": ["写作时需记住的设定规则"]
}`;
  }

  if (customInstruction) {
    userMessage += `\n\n额外要求：${customInstruction}`;
  }

  try {
    const config = getConfig();
    const prompt = buildPrompt({ skillId: 'outline-analysis', sources: [], userMessage, customInstruction });
    const provider = getProvider(config.provider);
    const messages = toMessages(prompt, [], skill.maxTokens);
    const result = await provider.chat(messages, {
      model: config.model, temperature: 0.4, maxTokens: skill.maxTokens,
    });

    let parsed;
    try {
      const jsonStr = result.content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsed = JSON.parse(jsonStr);
    } catch {
      return res.json({ success: false, error: 'AI 返回格式异常', raw: result.content });
    }

    res.json({ success: true, data: { ...parsed, type } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'AI 请求失败';
    res.status(500).json({ success: false, error: message });
  }
});

export default router;
