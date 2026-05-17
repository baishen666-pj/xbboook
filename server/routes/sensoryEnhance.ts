import { Router } from 'express';
import { z } from 'zod';
import { completeChat } from '../ai/agentFactory.js';
import { getSkill } from '../ai/writingSkills.js';
import { validate } from '../middleware/validate.js';
import { chapterRepo } from '../db/repositories/chapterRepo.js';

const router = Router({ mergeParams: true });

const enhanceSchema = z.object({
  skillId: z.enum(['sensory-expand', 'fight-choreograph', 'environment-builder']),
  chapterId: z.string().optional(),
  content: z.string().optional(),
  focus: z.enum(['all', 'visual', 'auditory', 'olfactory', 'tactile', 'gustatory']).default('all'),
  intensity: z.enum(['subtle', 'moderate', 'intense']).default('moderate'),
});

router.post('/enhance', validate(enhanceSchema), async (req, res) => {
  const { projectId } = req.params;
  const { skillId, chapterId, content, focus, intensity } = req.body;
  const skill = getSkill(skillId);
  if (!skill) return res.status(400).json({ success: false, error: '无效的技能ID' });

  let text = content || '';
  if (!text && chapterId) {
    const ch = chapterRepo.findById(chapterId);
    if (ch) text = ch.content || '';
  }
  if (!text) {
    const chapters = chapterRepo.findByProject(projectId);
    text = chapters.slice(0, 3).map(c => c.content || '').join('\n\n');
  }

  const focusLabels: Record<string, string> = {
    all: '全面五感（视觉、听觉、嗅觉、触觉、味觉）',
    visual: '视觉描写（色彩、光影、形状、运动）',
    auditory: '听觉描写（声音、音乐、寂静）',
    olfactory: '嗅觉描写（气味、氛围）',
    tactile: '触觉描写（温度、质感、力度）',
    gustatory: '味觉描写（味道、口感）',
  };

  const intensityLabels: Record<string, string> = {
    subtle: '细腻含蓄，点到为止',
    moderate: '适度展开，情景交融',
    intense: '浓墨重彩，沉浸体验',
  };

  let prompt = '';
  if (skillId === 'sensory-expand') {
    prompt = `请分析以下文本，并为其添加${focusLabels[focus]}的感官描写。

强度要求：${intensityLabels[intensity]}

原文：
${text.slice(0, 3000)}

以JSON格式返回：
{
  "enhanced_text": "增强后的文本",
  "sensory_breakdown": {
    "visual": {"score": 80, "added": ["添加的视觉描写"]},
    "auditory": {"score": 60, "added": ["添加的听觉描写"]},
    "olfactory": {"score": 40, "added": ["添加的嗅觉描写"]},
    "tactile": {"score": 50, "added": ["添加的触觉描写"]},
    "gustatory": {"score": 30, "added": ["添加的味觉描写"]}
  },
  "original_sensory_scores": {"visual": 40, "auditory": 20, "olfactory": 10, "tactile": 15, "gustatory": 5},
  "suggestions": ["进一步提升的建议"]
}`;
  } else if (skillId === 'fight-choreograph') {
    prompt = `请为以下内容编排精彩的战斗/动作场景。

上下文：
${text.slice(0, 3000)}

以JSON格式返回：
{
  "choreography": {
    "phases": [{"name": "对峙", "description": "场景描述", "tension": 60}],
    "moves": [{"character": "角色名", "action": "动作描述", "sensory_detail": "感官细节", "timing": "节奏说明"}],
    "environment_use": ["环境利用"],
    "emotional_beats": ["情感节点"]
  },
  "enhanced_text": "完整编写的战斗场景",
  "pacing_analysis": {"overall": "快节奏", "rhythm": "缓急交替", "climax_position": "70%"},
  "tips": ["写作技巧"]
}`;
  } else {
    prompt = `请为以下内容构建沉浸式的环境与氛围描写。

原文：
${text.slice(0, 3000)}

以JSON格式返回：
{
  "atmosphere": {
    "mood": "整体氛围（如：紧张压抑、温暖明亮）",
    "elements": [{"type": "自然/建筑/光线/天气/声音", "description": "描写内容", "emotion": "暗示的情感"}],
    "sensory_layers": ["感官层次"]
  },
  "enhanced_text": "增强后的环境描写文本",
  "symbolism": ["环境中的隐喻和象征"],
  "transition_suggestions": ["场景转换建议"]
}`;
  }

  try {
    const response = await completeChat(
      [{ role: 'system', content: skill.systemPrompt }, { role: 'user', content: prompt }],
      { temperature: skill.temperature, maxTokens: skill.maxTokens },
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
