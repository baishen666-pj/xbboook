import { Router } from 'express';
import { z } from 'zod';
import { completeChat } from '../ai/agentFactory.js';
import { getSkill } from '../ai/writingSkills.js';
import { validate } from '../middleware/validate.js';
import * as chapterRepo from '../db/repositories/chapterRepo.js';

const router = Router({ mergeParams: true });

const READER_GROUPS = [
  { id: 'young_male', name: '年轻男性(18-25)', desc: '偏好热血、爽文、系统流' },
  { id: 'young_female', name: '年轻女性(18-25)', desc: '偏好甜宠、虐恋、重生' },
  { id: 'mature_male', name: '中年男性(30-45)', desc: '偏好历史、官场、商战' },
  { id: 'mature_female', name: '中年女性(30-45)', desc: '偏好家庭、职场、情感' },
  { id: 'hardcore_reader', name: '资深书虫', desc: '看重文笔、逻辑、创新' },
  { id: 'casual_reader', name: '休闲读者', desc: '追求轻松、消遣、打发时间' },
];

const simulateSchema = z.object({
  chapterIds: z.array(z.string()).optional(),
  groups: z.array(z.string()).optional(),
  aspects: z.array(z.enum(['satisfaction', 'retention', 'payment', 'sharing', 'review'])).default(['satisfaction', 'retention', 'payment']),
});

router.post('/simulate', validate(simulateSchema), async (req, res) => {
  const skill = getSkill('reader-group-sim');
  const { projectId } = req.params;
  const { chapterIds, groups, aspects } = req.body;

  const chapters = chapterIds?.length
    ? chapterRepo.findByProject(projectId).filter(c => chapterIds.includes(c.id))
    : chapterRepo.findByProject(projectId);

  const chapterInfo = chapters.slice(0, 15).map((c, i) => {
    const content = c.content || '';
    return `第${i + 1}章《${c.title}》| 字数:${content.length} | 摘要:${c.ai_summary || content.slice(0, 120)}`;
  }).join('\n');

  const targetGroups = groups?.length ? READER_GROUPS.filter(g => groups.includes(g.id)) : READER_GROUPS;
  const aspectLabels: Record<string, string> = {
    satisfaction: '满意度', retention: '留存意愿', payment: '付费意愿', sharing: '推荐意愿', review: '评价倾向',
  };

  const prompt = `请模拟以下读者群体对这部小说的反应。

小说章节：
${chapterInfo}

目标读者群体：${targetGroups.map(g => `${g.name}(${g.desc})`).join('、')}
分析维度：${aspects.map(a => aspectLabels[a]).join('、')}

以JSON格式返回：
{
  "work_positioning": {"genre": "类型", "target_audience": "目标读者", "market_position": "市场定位"},
  "group_reactions": [${targetGroups.map(g => `{
    "group_id": "${g.id}",
    "group_name": "${g.name}",
    "overall_score": 75,
    "satisfaction": 78,
    "retention": 72,
    "payment_willingness": 65,
    "sharing_likelihood": 60,
    "favorite_aspects": ["喜欢的方面"],
    "pain_points": ["痛点"],
    "dropoff_risk": "low/medium/high",
    "typical_comment": "一条典型的读者评论",
    "reading_behavior": "阅读行为描述",
    "improvement_wishes": ["期望改进"]
  }`).join(',')}],
  "market_analysis": {
    "total_addressable_audience": "潜在读者规模估计",
    "primary_segment": {"group": "最佳匹配群体", "affinity": 85},
    "secondary_segments": [{"group": "次要群体", "affinity": 60}],
    "competitive_advantage": "竞争优势",
    "market_risks": ["市场风险"],
    "monetization_tips": ["变现建议"]
  },
  "cross_group_insights": ["跨群体的共同反馈"],
  "recommendations": ["综合建议"]
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

router.get('/groups', (_req, res) => {
  res.json({ success: true, data: READER_GROUPS });
});

export default router;
