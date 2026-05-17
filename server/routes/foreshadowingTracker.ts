import { Router } from 'express';
import { z } from 'zod';
import { completeChat } from '../ai/agentFactory.js';
import { getSkill } from '../ai/writingSkills.js';
import { validate } from '../middleware/validate.js';
import { chapterRepo } from '../db/repositories/chapterRepo.js';

const router = Router({ mergeParams: true });

const trackSchema = z.object({
  chapterIds: z.array(z.string()).optional(),
  mode: z.enum(['detect', 'health', 'suggest']).default('detect'),
});

router.post('/track', validate(trackSchema), async (req, res) => {
  const skill = getSkill('foreshadowing-tracker');
  const { projectId } = req.params;
  const { chapterIds, mode } = req.body;

  const chapters = chapterIds?.length
    ? chapterRepo.findByProject(projectId).filter(c => chapterIds.includes(c.id))
    : chapterRepo.findByProject(projectId);

  const chapterInfo = chapters.slice(0, 25).map((c, i) => {
    const content = c.content || '';
    return `第${i + 1}章《${c.title}》| 摘要:${c.ai_summary || content.slice(0, 200)}`;
  }).join('\n');

  const modePrompts: Record<string, string> = {
    detect: `请从以下章节中检测所有伏笔，包括已种植和已回收的。

章节信息：
${chapterInfo}

以JSON格式返回：
{
  "foreshadowings": [{
    "id": 1,
    "title": "伏笔标题",
    "description": "伏笔描述",
    "plant_chapter": 3,
    "plant_detail": "种植细节",
    "technique": "symbolic/dialogue/imagery/structural/prophecy",
    "technique_name": "象征暗示",
    "status": "planted/resolved/partially_resolved/abandoned",
    "resolve_chapter": 15,
    "resolve_detail": "回收方式",
    "subtlety": 80,
    "satisfaction": 85,
    "importance": "major/minor/background",
    "related_plot_thread": "关联剧情线",
    "tags": ["标签"]
  }],
  "statistics": {
    "total": 10,
    "resolved": 6,
    "planted": 3,
    "abandoned": 1,
    "resolution_rate": 60,
    "avg_satisfaction": 82
  }
}`,
    health: `请评估以下章节中伏笔系统的健康状态。

章节信息：
${chapterInfo}

以JSON格式返回：
{
  "health_score": 78,
  "status": "good/warning/critical",
  "timeline": [{
    "chapter": 1,
    "planted": 2,
    "resolved": 0,
    "open_count": 2
  }],
  "issues": [{
    "type": "overdue/unresolved/weak_resolution/dense_planting",
    "severity": "high/medium/low",
    "description": "问题描述",
    "affected_foreshadowings": [1],
    "suggestion": "修复建议"
  }],
  "balance_analysis": {
    "planting_rhythm": "均匀/集中/稀疏",
    "resolution_rhythm": "及时/延迟/过快",
    "tension_curve": "伏笔张力曲线描述"
  },
  "recommendations": ["改进建议"]
}`,
    suggest: `请分析以下章节中的伏笔，并为尚未回收的伏笔建议回收方式。

章节信息：
${chapterInfo}

以JSON格式返回：
{
  "unresolved": [{
    "id": 1,
    "title": "伏笔标题",
    "plant_chapter": 3,
    "importance": "major",
    "suggestions": [{
      "method": "回收方式",
      "timing": "建议回收时机",
      "sample_text": "示例文本（200字以内）",
      "impact": "对剧情的影响",
      "difficulty": "easy/medium/hard"
    }]
  }],
  "new_opportunities": [{
    "description": "新伏笔种植机会",
    "suggested_chapter": 5,
    "purpose": "目的",
    "sample_text": "示例文本（100字以内）"
  }],
  "weaving_tips": ["伏笔编织技巧"]
}`,
  };

  try {
    const response = await completeChat(
      [{ role: 'system', content: skill?.systemPrompt || '' }, { role: 'user', content: modePrompts[mode] }],
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

export default router;
