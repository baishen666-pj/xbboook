import { Router } from 'express';
import { z } from 'zod';
import { completeChat } from '../ai/agentFactory.js';
import { getSkill } from '../ai/writingSkills.js';
import { validate } from '../middleware/validate.js';
import { chapterRepo } from '../db/repositories/chapterRepo.js';

const router = Router({ mergeParams: true });

const analyzeSchema = z.object({
  chapterIds: z.array(z.string()).optional(),
  depth: z.enum(['surface', 'deep', 'comprehensive']).default('deep'),
});

router.post('/analyze', validate(analyzeSchema), async (req, res) => {
  const skill = getSkill('theme-analyze');
  const { projectId } = req.params;
  const { chapterIds, depth } = req.body;

  const chapters = chapterIds?.length
    ? chapterRepo.findByProject(projectId).filter(c => chapterIds.includes(c.id))
    : chapterRepo.findByProject(projectId);

  const chapterText = chapters.slice(0, 20).map((c, i) => {
    const content = c.content || '';
    return `第${i + 1}章《${c.title}》| ${content.slice(0, 300)}`;
  }).join('\n');

  const depthMap: Record<string, string> = {
    surface: '表层主题识别',
    deep: '深层主题+母题+象征分析',
    comprehensive: '全面分析含文化语境和文学传统关联',
  };

  const prompt = `请${depthMap[depth]}以下小说的主题体系。

${chapterText.slice(0, 6000)}

以JSON格式返回：
{
  "primary_themes": [{
    "theme": "主题名称",
    "description": "主题描述",
    "prominence": 90,
    "chapters_present": [1, 3, 7],
    "key_quotes": ["体现该主题的关键文本"],
    "literary_tradition": "该主题的文学传统渊源"
  }],
  "motifs": [{
    "motif": "母题名称",
    "type": "image/symbol/action/setting/character",
    "occurrences": [{"chapter": 1, "description": "出现方式"}],
    "evolution": "该母题的演变",
    "significance": "象征意义"
  }],
  "symbolism": [{
    "symbol": "象征物",
    "literal_meaning": "字面含义",
    "metaphorical_meaning": "隐喻含义",
    "occurrences": 5,
    "layers": ["表层含义", "深层含义"]
  }],
  "thematic_arc": {
    "pattern": "主题发展模式",
    "central_conflict": "核心冲突",
    "resolution_direction": "解决方向",
    "philosophical_depth": 80
  },
  "literary_analysis": {
    "genre_contribution": "对该类型文学的贡献",
    "originality": 75,
    "cultural_context": "文化语境分析",
    "comparative_notes": "与同类作品的比较"
  },
  "suggestions": ["深化主题的建议"]
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
