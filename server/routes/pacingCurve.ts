import { Router } from 'express';
import { z } from 'zod';
import { completeChat } from '../ai/agentFactory.js';
import { getSkill } from '../ai/writingSkills.js';
import { validate } from '../middleware/validate.js';
import { chapterRepo } from '../db/repositories/chapterRepo.js';

const router = Router({ mergeParams: true });

const curveSchema = z.object({
  chapterIds: z.array(z.string()).optional(),
  dimensions: z.array(z.enum(['tension', 'pace', 'emotion', 'info_density', 'character_activity', 'conflict'])).default(['tension', 'pace', 'emotion']),
});

router.post('/generate', validate(curveSchema), async (req, res) => {
  const skill = getSkill('pacing-curve');
  const { projectId } = req.params;
  const { chapterIds, dimensions } = req.body;

  const chapters = chapterIds?.length
    ? chapterRepo.findByProject(projectId).filter(c => chapterIds.includes(c.id))
    : chapterRepo.findByProject(projectId);

  const chapterInfo = chapters.slice(0, 30).map((c, i) => {
    const content = c.content || '';
    return `第${i + 1}章《${c.title}》| 字数:${content.length} | 摘要:${c.ai_summary || content.slice(0, 200)}`;
  }).join('\n');

  const dimLabels: Record<string, string> = {
    tension: '张力值', pace: '节奏速度', emotion: '情感强度',
    info_density: '信息密度', character_activity: '角色活跃度', conflict: '冲突程度',
  };

  const dimsDesc = dimensions.map(d => dimLabels[d]).join('、');

  const prompt = `请分析以下小说章节的节奏曲线，包含以下维度：${dimsDesc}

章节信息：
${chapterInfo}

以JSON格式返回：
{
  "curve_data": [${chapters.slice(0, 30).map((_, i) => `
    {
      "chapter": ${i + 1},
      "title": "章节标题",
      ${dimensions.map(d => `"${d}": ${Math.floor(Math.random() * 40) + 30}`).join(',\n      ')}
    }`).join(',')}
  ],
  "segments": [
    {"name": "开篇引入", "chapters": [1, 3], "avg_tension": 45, "description": "节奏描述"},
    {"name": "发展阶段", "chapters": [4, 10], "avg_tension": 60, "description": "节奏描述"},
    {"name": "高潮段落", "chapters": [11, 15], "avg_tension": 85, "description": "节奏描述"},
    {"name": "收尾阶段", "chapters": [16, 20], "avg_tension": 50, "description": "节奏描述"}
  ],
  "rhythm_pattern": "快-慢-快-慢交替" ,
  "problem_areas": [{"chapter": 5, "issue": "节奏过于平缓", "suggestion": "建议添加冲突事件"}],
  "peak_chapters": [{"chapter": 12, "type": "高潮", "intensity": 90}],
  "overall_assessment": {
    "pacing_score": 78,
    "balance": "基本均衡",
    "strength": "优点",
    "weakness": "不足",
    "recommendations": ["建议1", "建议2"]
  }
}`;

  try {
    const response = await completeChat(
      [{ role: 'system', content: skill?.systemPrompt || '你是叙事节奏分析师。' }, { role: 'user', content: prompt }],
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
