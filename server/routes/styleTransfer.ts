import { Router } from 'express';
import { z } from 'zod';
import { completeChat } from '../ai/agentFactory.js';
import { getSkill } from '../ai/writingSkills.js';
import { validate } from '../middleware/validate.js';
import { chapterRepo } from '../db/repositories/chapterRepo.js';

const router = Router({ mergeParams: true });

const PRESET_STYLES = [
  { id: 'classical', name: '古典文学', authors: ['鲁迅', '张爱玲', '沈从文', '钱钟书'] },
  { id: 'wuxia', name: '武侠风格', authors: ['金庸', '古龙', '梁羽生'] },
  { id: 'modern', name: '现代文学', authors: ['莫言', '余华', '王小波', '苏童'] },
  { id: 'scifi', name: '科幻风格', authors: ['刘慈欣', '阿西莫夫', '菲利普·迪克'] },
  { id: 'xianxia', name: '仙侠风格', authors: ['忘语', '耳根', '猫腻'] },
  { id: 'urban', name: '都市言情', authors: ['顾漫', '丁墨', '匪我思存'] },
  { id: 'suspense', name: '悬疑推理', authors: ['东野圭吾', '紫金陈', '阿加莎'] },
  { id: 'lightnovel', name: '轻小说', authors: ['川原砾', '西尾维新', '镰池和马'] },
];

const transferSchema = z.object({
  content: z.string().optional(),
  chapterId: z.string().optional(),
  styleId: z.string(),
  authorName: z.string().optional(),
  intensity: z.enum(['subtle', 'moderate', 'strong']).default('moderate'),
});

router.post('/transfer', validate(transferSchema), async (req, res) => {
  const skill = getSkill('style-transfer');
  const { projectId } = req.params;
  const { content, chapterId, styleId, authorName, intensity } = req.body;

  let text = content || '';
  if (!text && chapterId) {
    const ch = chapterRepo.findById(chapterId);
    if (ch) text = ch.content || '';
  }
  if (!text) {
    const chapters = chapterRepo.findByProject(projectId);
    text = chapters.slice(0, 2).map(c => c.content || '').join('\n\n');
  }

  const style = PRESET_STYLES.find(s => s.id === styleId);
  if (!style) return res.status(400).json({ success: false, error: '无效的风格ID' });

  const targetAuthor = authorName || style.authors[0];
  const intensityMap: Record<string, string> = {
    subtle: '轻微点缀，保留大部分原文风格',
    moderate: '中等程度融合，明显体现目标风格',
    strong: '深度风格转换，完全以目标风格重写',
  };

  const prompt = `请将以下文本迁移为"${targetAuthor}"的写作风格（${style.name}类型）。

风格转换强度：${intensityMap[intensity]}

原文：
${text.slice(0, 3000)}

以JSON格式返回：
{
  "style_analysis": {
    "original_traits": ["原文风格特征"],
    "target_traits": ["目标风格特征"],
    "key_changes": ["主要变化点"]
  },
  "transformed_text": "风格迁移后的文本",
  "style_score": {
    "original": {"${styleId}": 20, "other": 80},
    "transformed": {"${styleId}": 75, "other": 25}
  },
  "preservation_check": {
    "plot_preserved": true,
    "character_preserved": true,
    "key_info_preserved": true,
    "notes": "保留说明"
  },
  "tips": ["风格写作技巧"]
}`;

  try {
    const response = await completeChat(
      [{ role: 'system', content: skill?.systemPrompt || '' }, { role: 'user', content: prompt }],
      { temperature: skill?.temperature ?? 0.8, maxTokens: skill?.maxTokens ?? 4000 },
    );
    let parsed;
    try { parsed = JSON.parse(response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()); } catch {
      const m = response.match(/\{[\s\S]*\}/);
      if (!m) return res.json({ success: false, error: 'AI 返回格式异常', raw: response });
      parsed = JSON.parse(m[0]);
    }
    res.json({ success: true, data: { ...parsed, preset_styles: PRESET_STYLES } });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : '请求失败' });
  }
});

const imitateSchema = z.object({
  authorName: z.string(),
  content: z.string().optional(),
  chapterId: z.string().optional(),
  scene: z.string().optional(),
});

router.post('/imitate', validate(imitateSchema), async (req, res) => {
  const skill = getSkill('author-imitate');
  const { projectId } = req.params;
  const { authorName, content, chapterId, scene } = req.body;

  let context = content || '';
  if (!context && chapterId) {
    const ch = chapterRepo.findById(chapterId);
    if (ch) context = ch.content || '';
  }

  const prompt = `请模仿"${authorName}"的风格，${scene ? `描写以下场景：${scene}` : '基于以下上下文继续创作'}。

${context ? `参考上下文：\n${context.slice(0, 2000)}` : '请自由发挥一段约500字的创作。'}

以JSON格式返回：
{
  "imitated_text": "模仿创作的内容",
  "style_signature": {
    "sentence_patterns": ["句式特征"],
    "vocabulary_style": "用词特点",
    "rhythm": "节奏特点",
    "rhetoric": "修辞手法",
    "tone": "语调特点"
  },
  "similarity_analysis": {
    "overall": 85,
    "vocabulary": 80,
    "rhythm": 88,
    "tone": 82,
    "technique": 86
  },
  "tips": ["如何进一步接近该作家风格的建议"]
}`;

  try {
    const response = await completeChat(
      [{ role: 'system', content: skill?.systemPrompt || '' }, { role: 'user', content: prompt }],
      { temperature: skill?.temperature ?? 0.85, maxTokens: skill?.maxTokens ?? 4000 },
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

router.get('/styles', (_req, res) => {
  res.json({ success: true, data: PRESET_STYLES });
});

export default router;
