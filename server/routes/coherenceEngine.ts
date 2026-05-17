import { Router } from 'express';
import { z } from 'zod';
import { completeChat } from '../ai/agentFactory.js';
import { getSkill } from '../ai/writingSkills.js';
import { validate } from '../middleware/validate.js';
import { chapterRepo } from '../db/repositories/chapterRepo.js';
import { characterRepo } from '../db/repositories/characterRepo.js';
import { foreshadowingRepo } from '../db/repositories/foreshadowingRepo.js';

const router = Router({ mergeParams: true });

const checkSchema = z.object({
  scope: z.enum(['full', 'volume', 'chapter']).default('full'),
  volumeStart: z.number().optional(),
  volumeEnd: z.number().optional(),
  checks: z.array(z.enum(['timeline', 'character', 'geography', 'setting', 'foreshadowing', 'naming', 'all'])).default(['all']),
});

router.post('/check', validate(checkSchema), async (req, res) => {
  const skill = getSkill('coherence-engine');
  const { projectId } = req.params;
  const { scope, volumeStart, volumeEnd, checks } = req.body;

  const allChapters = chapterRepo.findByProject(projectId);
  let chapters = allChapters;
  if (scope === 'volume' && volumeStart !== undefined && volumeEnd !== undefined) {
    chapters = allChapters.slice(volumeStart - 1, volumeEnd);
  } else if (scope === 'chapter') {
    chapters = allChapters.slice(-3);
  }

  const characters = characterRepo.findByProject(projectId);
  const foreshadowings = foreshadowingRepo.findByProject(projectId);

  const chapterSummaries = chapters.slice(0, 30).map((c, i) => `第${i + 1}章 ${c.title}：${c.ai_summary || (c.content || '').slice(0, 150)}`).join('\n');
  const characterList = characters.map(c => `${c.name}(${c.role})`).join('、');
  const foreshadowList = foreshadowings.map(f => `${f.title}[${f.status}]`).join('、');

  const checkLabels = checks.includes('all')
    ? '时间线、角色一致性、地理设定、世界观、伏笔回收、称谓规范'
    : checks.map((c: string) => ({ timeline: '时间线', character: '角色一致性', geography: '地理设定', setting: '世界观', foreshadowing: '伏笔回收', naming: '称谓规范' })[c] || c).join('、');

  const prompt = `请对以下小说进行长篇连贯性检查，重点检查：${checkLabels}

章节概要：
${chapterSummaries}

角色：${characterList}
伏笔：${foreshadowList || '无'}

以JSON格式返回：{
  "overall_coherence": 82,
  "checks": [{
    "type": "时间线",
    "score": 85,
    "issues": [{
      "severity": "warning",
      "description": "问题描述",
      "chapters": [3, 5],
      "suggestion": "修复建议"
    }]
  }],
  "foreshadowing_status": {
    "planted_but_unresolved": ["未回收伏笔1"],
    "resolved_well": ["完美回收伏笔1"],
    "orphaned": ["孤立伏笔1"]
  },
  "cross_volume_issues": ["跨卷问题1"],
  "recommendations": ["建议1"]
}`;

  try {
    const response = await completeChat(
      [{ role: 'system', content: skill?.systemPrompt || '你是专业的故事连贯性审核专家。' }, { role: 'user', content: prompt }],
      { temperature: skill?.temperature ?? 0.3, maxTokens: skill?.maxTokens ?? 5000 },
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
