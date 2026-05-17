import { Router } from 'express';
import { z } from 'zod';
import { completeChat } from '../ai/agentFactory.js';
import { getSkill } from '../ai/writingSkills.js';
import { validate } from '../middleware/validate.js';
import { chapterRepo } from '../db/repositories/chapterRepo.js';

const router = Router({ mergeParams: true });

const consistencySchema = z.object({
  chapterIds: z.array(z.string()).optional(),
  characterNames: z.array(z.string()).optional(),
});

router.post('/check', validate(consistencySchema), async (req, res) => {
  const skill = getSkill('dialogue-consistency');
  const { projectId } = req.params;
  const { chapterIds, characterNames } = req.body;

  const chapters = chapterIds?.length
    ? chapterRepo.findByProject(projectId).filter(c => chapterIds.includes(c.id))
    : chapterRepo.findByProject(projectId);

  const chapterText = chapters.slice(0, 20).map((c, i) => {
    const content = c.content || '';
    return `第${i + 1}章《${c.title}》\n${content.slice(0, 500)}`;
  }).join('\n\n---\n\n');

  const prompt = `请分析以下小说中角色对话的风格一致性。${characterNames?.length ? `重点关注：${characterNames.join('、')}` : '分析所有主要角色'}

文本内容：
${chapterText.slice(0, 6000)}

以JSON格式返回：
{
  "characters": [{
    "name": "角色名",
    "voice_profile": {
      "vocabulary_style": "用词特点",
      "sentence_pattern": "句式特征",
      "tone": "语调",
      "catchphrases": ["口头禅"],
      "emotional_range": "情感表达范围",
      "formality": "formal/casual/mixed"
    },
    "consistency_score": 85,
    "inconsistent_chapters": [{"chapter": 5, "issue": "问题", "original": "原句", "suggestion": "建议修改"}],
    "overall_assessment": "评估"
  }],
  "global_findings": {
    "dialogue_quality": 80,
    "character_distinctiveness": 75,
    "issues": ["全局问题"],
    "strengths": ["优点"]
  },
  "recommendations": ["改进建议"]
}`;

  try {
    const response = await completeChat(
      [{ role: 'system', content: skill?.systemPrompt || '' }, { role: 'user', content: prompt }],
      { temperature: skill?.temperature ?? 0.4, maxTokens: skill?.maxTokens ?? 5000 },
    );
    let parsed;
    try { parsed = JSON.parse(response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()); } catch {
      const m = response.match(/\{[\s\S]*\}/);
      if (!m) return res.json({ success: false, error: 'AI 返回格式异常', raw: response });
      parsed = JSON.parse(m[0]);
    }
    res.json({ success: true, data: parsed });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : '请求失败' });
  }
});

const voiceSchema = z.object({
  characterName: z.string(),
  chapterIds: z.array(z.string()).optional(),
});

router.post('/voice-profile', validate(voiceSchema), async (req, res) => {
  const skill = getSkill('voice-check');
  const { projectId } = req.params;
  const { characterName, chapterIds } = req.body;

  const chapters = chapterIds?.length
    ? chapterRepo.findByProject(projectId).filter(c => chapterIds.includes(c.id))
    : chapterRepo.findByProject(projectId);

  const chapterText = chapters.slice(0, 15).map((c, i) => {
    const content = c.content || '';
    return `第${i + 1}章：${content.slice(0, 400)}`;
  }).join('\n---\n');

  const prompt = `请为角色"${characterName}"创建详细的语音档案。

从以下文本中提取该角色的所有对话：
${chapterText.slice(0, 5000)}

以JSON格式返回：
{
  "character_name": "${characterName}",
  "voice_archetype": "语音原型（如：冷酷霸总、活泼少女、沉稳长者）",
  "features": {
    "vocabulary": {"level": "高雅/通俗/文雅", "preferred_words": ["偏好用词"], "avoided_words": ["避免用词"]},
    "syntax": {"avg_sentence_length": 15, "pattern": "短句为主/长句为主/混合", "special_patterns": ["特殊句式"]},
    "tone": {"primary": "主要语调", "secondary": "次要语调", "range": "语调变化范围"},
    "emotional_expression": {"style": "表达方式", "triggers": ["情感触发点"], "suppression": "压抑表现"},
    "speech_habits": ["说话习惯"],
    "catchphrases": ["口头禅或标志性用语"]
  },
  "sample_dialogues": [{"context": "场景", "line": "台词", "features_shown": ["展示的特征"]}],
  "consistency_tips": ["保持语音一致性的技巧"]
}`;

  try {
    const response = await completeChat(
      [{ role: 'system', content: skill?.systemPrompt || '' }, { role: 'user', content: prompt }],
      { temperature: skill?.temperature ?? 0.4, maxTokens: skill?.maxTokens ?? 4000 },
    );
    let parsed;
    try { parsed = JSON.parse(response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()); } catch {
      const m = response.match(/\{[\s\S]*\}/);
      if (!m) return res.json({ success: false, error: 'AI 返回格式异常', raw: response });
      parsed = JSON.parse(m[0]);
    }
    res.json({ success: true, data: parsed });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : '请求失败' });
  }
});

export default router;
