import { Router } from 'express';
import { z } from 'zod';
import { completeChat } from '../ai/agentFactory.js';
import { getSkill } from '../ai/writingSkills.js';
import { validate } from '../middleware/validate.js';
import { chapterRepo } from '../db/repositories/chapterRepo.js';

const router = Router({ mergeParams: true });

const analyzeSchema = z.object({
  chapterIds: z.array(z.string()).optional(),
  characterPair: z.array(z.string()).length(2).optional(),
});

router.post('/analyze', validate(analyzeSchema), async (req, res) => {
  const skill = getSkill('relationship-evolution');
  const { projectId } = req.params;
  const { chapterIds, characterPair } = req.body;

  const chapters = chapterIds?.length
    ? chapterRepo.findByProject(projectId).filter(c => chapterIds.includes(c.id))
    : chapterRepo.findByProject(projectId);

  const chapterInfo = chapters.slice(0, 25).map((c, i) => {
    const content = c.content || '';
    return `第${i + 1}章《${c.title}》| ${content.slice(0, 250)}`;
  }).join('\n');

  const focus = characterPair ? `重点关注 ${characterPair[0]} 和 ${characterPair[1]} 的关系` : '分析所有主要角色间的关系';

  const prompt = `请分析以下小说中角色关系的演变。${focus}

章节内容：
${chapterInfo.slice(0, 6000)}

以JSON格式返回：
{
  "pairs": [{
    "characters": ["角色A", "角色B"],
    "relationship_type": "恋人/师徒/对手/盟友/亲人",
    "evolution": [{"chapter": 1, "state": "陌生", "intimacy": 20, "event": "首次相遇"}, {"chapter": 5, "state": "冲突", "intimacy": 35, "event": "关键事件"}],
    "turning_points": [{"chapter": 8, "event": "关系转折事件", "from_state": "对立", "to_state": "合作"}],
    "current_state": "当前关系状态",
    "predicted_direction": "预测发展方向",
    "dynamics_score": 82
  }],
  "relationship_map": {
    "total_pairs": 6,
    "most_dynamic": "变化最多的关系对",
    "most_stable": "最稳定的关系对",
    "tension_hotspot": "张力最高的关系"
  },
  "suggestions": [{"pair": "角色A-角色B", "suggestion": "关系发展建议", "timing": "建议时机"}]
}`;

  try {
    const response = await completeChat(
      [{ role: 'system', content: skill?.systemPrompt || '' }, { role: 'user', content: prompt }],
      { temperature: skill?.temperature ?? 0.5, maxTokens: skill?.maxTokens ?? 5000 },
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
