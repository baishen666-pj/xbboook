import { Router } from 'express';
import { z } from 'zod';
import { completeChat } from '../ai/agentFactory.js';
import { getSkill } from '../ai/writingSkills.js';
import { validate } from '../middleware/validate.js';
import { chapterRepo } from '../db/repositories/chapterRepo.js';

const router = Router({ mergeParams: true });

const analyzeSchema = z.object({
  chapterIds: z.array(z.string()).optional(),
  focus: z.enum(['attention', 'emotion', 'immersion', 'addiction', 'all']).default('all'),
});

router.post('/analyze', validate(analyzeSchema), async (req, res) => {
  const skill = getSkill('reader-psychology');
  const { projectId } = req.params;
  const { chapterIds, focus } = req.body;

  const chapters = chapterIds?.length
    ? chapterRepo.findByProject(projectId).filter(c => chapterIds.includes(c.id))
    : chapterRepo.findByProject(projectId);

  const chapterInfo = chapters.slice(0, 20).map((c, i) => {
    const content = c.content || '';
    return `第${i + 1}章《${c.title}》| ${content.slice(0, 250)}`;
  }).join('\n');

  const focusLabels: Record<string, string> = {
    attention: '注意力管理', emotion: '情绪引导', immersion: '沉浸感设计', addiction: '成瘾机制', all: '全部维度',
  };

  const prompt = `请从认知心理学角度分析以下小说对读者的心理影响，重点关注：${focusLabels[focus]}

${chapterInfo.slice(0, 6000)}

以JSON格式返回：
{
  "psychological_profile": {
    "attention_management": {
      "score": 78,
      "hooks_used": ["使用的注意力钩子"],
      "weak_moments": [{"chapter": 5, "issue": "注意力低谷原因"}],
      "improvements": ["注意力优化建议"]
    },
    "emotional_engineering": {
      "score": 82,
      "techniques": ["情绪引导技巧"],
      "emotional_peaks": [{"chapter": 3, "technique": "情感爆发技巧"}],
      "emotional_gaps": [{"chapter": 6, "issue": "情感空白"}],
      "improvements": ["情绪优化建议"]
    },
    "immersion_factors": {
      "score": 75,
      "breaking_factors": ["破坏沉浸的因素"],
      "enhancing_factors": ["增强沉浸的因素"],
      "improvements": ["沉浸感优化建议"]
    },
    "addiction_mechanisms": {
      "score": 80,
      "variable_rewards": [{"chapter": 2, "type": "不可预测奖励", "description": "描述"}],
      "cliffhangers": [{"chapter": 5, "type": "悬念类型", "strength": 85}],
      "progress_loops": ["进度循环机制"],
      "social_proof_triggers": ["社交认同触发器"],
      "improvements": ["成瘾机制优化"]
    }
  },
  "reader_journey_map": {
    "cognitive_load": [${chapters.slice(0, 15).map((_, i) => `{"chapter": ${i + 1}, "load": ${Math.floor(Math.random() * 50) + 30}}`).join(',')}],
    "engagement_prediction": [{"chapter": 1, "predicted_engagement": 85, "primary_driver": "好奇心"}],
    "dropoff_risks": [{"chapter": 4, "risk": 35, "psychological_reason": "认知负荷过高"}]
  },
  "psychological_triggers": [{
    "trigger": "蔡格尼克效应",
    "description": "未完成任务在记忆中保持活跃",
    "current_usage": 75,
    "optimal_usage": "建议使用方式",
    "sample_implementation": "示例实现（150字）"
  }],
  "recommendations": ["心理学应用建议"]
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
