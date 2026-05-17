import { Router } from 'express';
import { z } from 'zod';
import { completeChat } from '../ai/agentFactory.js';
import { getSkill } from '../ai/writingSkills.js';
import { validate } from '../middleware/validate.js';
import { chapterRepo } from '../db/repositories/chapterRepo.js';

const router = Router({ mergeParams: true });

const coverSchema = z.object({
  genre: z.string().min(1),
  mood: z.string().optional(),
  keyElements: z.array(z.string()).optional(),
  style: z.enum(['anime', 'realistic', 'fantasy', 'ink', 'minimalist', 'dark']).default('fantasy'),
});

const titleSchema = z.object({
  synopsis: z.string().min(20),
  genre: z.string().optional(),
  style: z.enum(['literary', 'hot-blooded', 'poetic', 'mysterious', 'casual', 'epic']).default('literary'),
  count: z.number().min(1).max(10).default(5),
});

const synopsisSchema = z.object({
  genre: z.string().min(1),
  chapterCount: z.number().optional(),
  keywords: z.array(z.string()).optional(),
  style: z.enum(['suspenseful', 'emotional', 'epic', 'humorous', 'concise', 'dramatic']).default('dramatic'),
});

router.post('/cover-prompt', validate(coverSchema), async (req, res) => {
  const skill = getSkill('cover-prompt');
  const { genre, mood, keyElements, style } = req.body;
  const prompt = `为以下类型的小说生成封面AI绘画提示词：
类型：${genre}
${mood ? `氛围：${mood}` : ''}
${keyElements?.length ? `关键元素：${keyElements.join('、')}` : ''}
风格：${style}

以JSON格式返回：{
  "prompts": [{
    "prompt": "英文绘画提示词（详细描述构图、色彩、光影）",
    "negative_prompt": "反向提示词",
    "parameters": { "width": 512, "height": 768, "steps": 30, "cfg_scale": 7 }
  }],
  "color_palette": ["主色调说明"],
  "composition": "构图建议"}`;

  try {
    const response = await completeChat(
      [{ role: 'system', content: skill?.systemPrompt || '你是一位专业的AI绘画提示词工程师。' }, { role: 'user', content: prompt }],
      { temperature: skill?.temperature ?? 0.8, maxTokens: skill?.maxTokens ?? 2000 },
    );
    let parsed;
    try {
      parsed = JSON.parse(response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());
    } catch {
      const m = response.match(/\{[\s\S]*\}/);
      if (!m) return res.json({ success: false, error: 'AI 返回格式异常', raw: response });
      parsed = JSON.parse(m[0]);
    }
    res.json({ success: true, data: parsed });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : '请求失败' });
  }
});

router.post('/title-optimize', validate(titleSchema), async (req, res) => {
  const skill = getSkill('title-optimize');
  const { synopsis, genre, style, count } = req.body;
  const prompt = `根据以下简介，生成${count}个候选书名：
简介：${synopsis}
${genre ? `类型：${genre}` : ''}
风格偏好：${style}

以JSON格式返回：{
  "titles": [{
    "title": "书名",
    "subtitle": "副标题（可选）",
    "reason": "命名理由",
    "score": 85
  }],
  "analysis": "书名策略分析"}`;

  try {
    const response = await completeChat(
      [{ role: 'system', content: skill?.systemPrompt || '你是一位资深网文编辑，精通书名包装。' }, { role: 'user', content: prompt }],
      { temperature: skill?.temperature ?? 0.85, maxTokens: skill?.maxTokens ?? 2000 },
    );
    let parsed;
    try {
      parsed = JSON.parse(response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());
    } catch {
      const m = response.match(/\{[\s\S]*\}/);
      if (!m) return res.json({ success: false, error: 'AI 返回格式异常', raw: response });
      parsed = JSON.parse(m[0]);
    }
    res.json({ success: true, data: parsed });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : '请求失败' });
  }
});

router.post('/synopsis', validate(synopsisSchema), async (req, res) => {
  const skill = getSkill('synopsis-generate');
  const { projectId } = req.params;
  const { genre, chapterCount, keywords, style } = req.body;

  const chapters = chapterRepo.findByProject(projectId);
  const existingSummary = chapters.slice(0, 5).map(c => c.ai_summary || '').filter(Boolean).join('\n');

  const prompt = `${existingSummary ? `以下是已有章节的摘要：\n${existingSummary}\n\n` : ''}请为以下类型的小说生成简介/大纲：
类型：${genre}
${chapterCount ? `预计章节数：${chapterCount}` : ''}
${keywords?.length ? `关键词：${keywords.join('、')}` : ''}
风格：${style}

以JSON格式返回：{
  "synopsis": "200-500字简介",
  "short_pitch": "一句话简介（30字内）",
  "selling_points": ["卖点1", "卖点2", "卖点3"],
  "tag_suggestions": ["标签1", "标签2"]
}`;

  try {
    const response = await completeChat(
      [{ role: 'system', content: skill?.systemPrompt || '你是一位网文策划编辑，擅长写出吸引读者的简介。' }, { role: 'user', content: prompt }],
      { temperature: skill?.temperature ?? 0.7, maxTokens: skill?.maxTokens ?? 2000 },
    );
    let parsed;
    try {
      parsed = JSON.parse(response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());
    } catch {
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
