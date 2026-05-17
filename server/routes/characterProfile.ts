import { Router } from 'express';
import { z } from 'zod';
import { completeChat } from '../ai/agentFactory.js';
import { getSkill } from '../ai/writingSkills.js';
import { validate } from '../middleware/validate.js';
import { characterRepo } from '../db/repositories/characterRepo.js';
import { chapterRepo } from '../db/repositories/chapterRepo.js';

const router = Router({ mergeParams: true });

const profileSchema = z.object({
  characterId: z.string().min(1),
  depth: z.enum(['basic', 'detailed', 'deep']).default('detailed'),
});

const arcSchema = z.object({
  characterId: z.string().min(1),
  arcType: z.enum(['growth', 'fall', 'flat', 'transformation', 'corruption']).default('growth'),
  targetChapters: z.number().optional(),
});

router.post('/profile', validate(profileSchema), async (req, res) => {
  const skill = getSkill('character-profile');
  const { projectId } = req.params;
  const { characterId, depth } = req.body;

  const character = characterRepo.findById(characterId);
  if (!character) return res.status(404).json({ success: false, error: '角色不存在' });

  const chapters = chapterRepo.findByProject(projectId).slice(0, 20);
  const appearances = chapters.filter(c => (c.content || '').includes(character.name)).map((c, i) => `第${i + 1}章 ${c.title}`).join('、');

  const depthLabels: Record<string, string> = { basic: '基础', detailed: '详细', deep: '深度' };
  const prompt = `请对以下角色进行${depthLabels[depth]}心理分析：

角色名：${character.name}
${character.description ? `描述：${character.description}` : ''}
${character.traits ? `特征：${character.traits}` : ''}
出场章节：${appearances || '无'}

以JSON格式返回：{
  "mbti": {"type": "INTJ", "confidence": 85, "dimensions": {"E_I": 30, "S_N": 70, "T_F": 60, "J_P": 80}, "explanation": "分析说明"},
  "enneagram": {"type": "5号", "wing": "4号", "explanation": "分析说明"},
  "big_five": {"openness": 80, "conscientiousness": 70, "extraversion": 30, "agreeableness": 50, "neuroticism": 60},
  "motivations": ["核心动机1"],
  "fears": ["核心恐惧1"],
  "values": ["核心价值观1"],
  "communication_style": "沟通风格描述",
  "conflict_style": "冲突处理方式",
  "growth_potential": 85,
  "story_role": "角色在故事中的功能分析"
}`;

  try {
    const response = await completeChat(
      [{ role: 'system', content: skill?.systemPrompt || '你是一位专业的角色心理分析师。' }, { role: 'user', content: prompt }],
      { temperature: skill?.temperature ?? 0.6, maxTokens: skill?.maxTokens ?? 3000 },
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

router.post('/arc-plan', validate(arcSchema), async (req, res) => {
  const skill = getSkill('character-arc');
  const { projectId } = req.params;
  const { characterId, arcType, targetChapters } = req.body;

  const character = characterRepo.findById(characterId);
  if (!character) return res.status(404).json({ success: false, error: '角色不存在' });

  const arcLabels: Record<string, string> = { growth: '成长弧光', fall: '堕落弧光', flat: '平坦弧光', transformation: '蜕变弧光', corruption: '腐蚀弧光' };

  const prompt = `请为角色规划${arcLabels[arcType]}：
角色：${character.name}
${character.description ? `描述：${character.description}` : ''}
${targetChapters ? `预计章节数：${targetChapters}` : ''}

以JSON格式返回：{
  "arc_type": "${arcType}",
  "start_state": {"belief": "初始信念", "want": "外在目标", "need": "内在需求", "flaw": "核心缺陷"},
  "end_state": {"belief": "终态信念", "resolution": "最终变化"},
  "milestones": [{
    "phase": "阶段名",
    "chapters": [1, 5],
    "event": "关键事件",
    "internal_change": "内在变化",
    "external_change": "外在变化"
  }],
  "key_scenes": ["关键场景描述1"],
  "pitfalls": ["常见陷阱1"]
}`;

  try {
    const response = await completeChat(
      [{ role: 'system', content: skill?.systemPrompt || '你是角色弧光规划专家。' }, { role: 'user', content: prompt }],
      { temperature: skill?.temperature ?? 0.7, maxTokens: skill?.maxTokens ?? 3000 },
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
