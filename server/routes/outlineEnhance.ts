import { Router } from 'express';
import { z } from 'zod';
import * as outlineRepo from '../db/repositories/outlineRepo.js';
import * as chapterRepo from '../db/repositories/chapterRepo.js';
import * as characterRepo from '../db/repositories/characterRepo.js';
import { buildPrompt, toMessages } from '../ai/promptBuilder.js';
import { getSkill } from '../ai/writingSkills.js';
import { getProvider } from '../ai/providers.js';
import { getConfig } from '../ai/configStore.js';
import { validate } from '../middleware/validate.js';

const router = Router({ mergeParams: true });

const expandSchema = z.object({
  outlineId: z.string().min(1),
  customInstruction: z.string().max(2000).optional(),
});

const templateSchema = z.object({
  genre: z.string().min(1).max(50),
  style: z.string().max(100).optional(),
  premise: z.string().max(2000).optional(),
  targetLength: z.string().max(20).optional(),
});

const analysisSchema = z.object({
  customInstruction: z.string().max(2000).optional(),
});

// Expand an outline node into sub-nodes via AI
router.post('/expand', validate(expandSchema), async (req, res) => {
  const { projectId } = req.params;
  const { outlineId, customInstruction } = req.body;

  const outline = outlineRepo.findById(outlineId);
  if (!outline) {
    return res.status(404).json({ success: false, error: '大纲节点不存在' });
  }

  const children = outlineRepo.findChildren(projectId, outlineId);
  const characters = characterRepo.findByProject(projectId);

  const skill = getSkill('outline-expand');
  if (!skill) {
    return res.status(500).json({ success: false, error: '技能不存在' });
  }

  const userMessage = `请扩展以下大纲节点：

标题：${outline.title}
${outline.content ? `描述：${outline.content}` : ''}
${children.length > 0 ? `已有子节点：${children.map((c: { title: string }) => c.title).join('、')}` : ''}
${characters.length > 0 ? `项目角色：${characters.slice(0, 10).map((c: { name: string }) => c.name).join('、')}` : ''}
${customInstruction ? `额外要求：${customInstruction}` : ''}`;

  try {
    const config = getConfig();
    const prompt = buildPrompt({
      skillId: 'outline-expand',
      sources: [],
      userMessage,
      customInstruction,
    });

    const provider = getProvider(config.provider);
    const messages = toMessages(prompt, [], skill.maxTokens);
    const result = await provider.chat(messages, {
      model: config.model,
      temperature: skill.temperature,
      maxTokens: skill.maxTokens,
    });

    let parsed;
    try {
      const jsonStr = result.content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsed = JSON.parse(jsonStr);
    } catch {
      return res.json({ success: false, error: 'AI 返回格式异常', raw: result.content });
    }

    // Create outline children from AI result
    const created = [];
    if (parsed.children && Array.isArray(parsed.children)) {
      const maxOrder = children.length > 0
        ? Math.max(...children.map((c: { sort_order: number }) => c.sort_order))
        : -1;

      for (let i = 0; i < parsed.children.length; i++) {
        const child = parsed.children[i];
        const node = outlineRepo.create({
          projectId,
          title: child.title ?? `子节点 ${i + 1}`,
          content: child.summary ?? child.description ?? '',
          level: (outline.level ?? 0) + 1,
          parentId: outlineId,
          sortOrder: maxOrder + 1 + i,
        });
        created.push(node);
      }
    }

    res.json({ success: true, data: { created, notes: parsed.expansion_notes ?? '' } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'AI 请求失败';
    res.status(500).json({ success: false, error: message });
  }
});

// Generate outline template via AI
router.post('/template', validate(templateSchema), async (req, res) => {
  const { genre, style, premise, targetLength } = req.body;

  const skill = getSkill('outline-template');
  if (!skill) {
    return res.status(500).json({ success: false, error: '技能不存在' });
  }

  const userMessage = `请生成一个大纲模板：
类型：${genre}
${style ? `风格：${style}` : ''}
${premise ? `故事设定：${premise}` : ''}
${targetLength ? `目标长度：${targetLength}` : '目标长度：80-120章'}`;

  try {
    const config = getConfig();
    const prompt = buildPrompt({
      skillId: 'outline-template',
      sources: [],
      userMessage,
    });

    const provider = getProvider(config.provider);
    const messages = toMessages(prompt, [], skill.maxTokens);
    const result = await provider.chat(messages, {
      model: config.model,
      temperature: skill.temperature,
      maxTokens: skill.maxTokens,
    });

    let parsed;
    try {
      const jsonStr = result.content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsed = JSON.parse(jsonStr);
    } catch {
      return res.json({ success: false, error: 'AI 返回格式异常', raw: result.content });
    }

    res.json({ success: true, data: parsed });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'AI 请求失败';
    res.status(500).json({ success: false, error: message });
  }
});

// Analyze outline structure
router.post('/analyze', validate(analysisSchema), async (req, res) => {
  const { projectId } = req.params;
  const { customInstruction } = req.body;

  const outlines = outlineRepo.findByProject(projectId);
  const chapters = chapterRepo.findByProject(projectId);

  if (outlines.length === 0 && chapters.length === 0) {
    return res.json({ success: true, data: { overall_score: 0, message: '项目尚无大纲内容' } });
  }

  const skill = getSkill('outline-analysis');
  if (!skill) {
    return res.status(500).json({ success: false, error: '技能不存在' });
  }

  const outlineText = outlines.map((o: { title: string; content: string | null; level: number }) =>
    `${'  '.repeat(o.level)}- ${o.title}${o.content ? `：${o.content.slice(0, 100)}` : ''}`
  ).join('\n');

  const chapterSummary = chapters.slice(0, 30).map((c: { title: string; word_count: number }) =>
    `${c.title} (${c.word_count}字)`
  ).join('、');

  const userMessage = `请分析以下大纲结构：

【大纲节点】
${outlineText || '（无大纲）'}

【已有章节】
${chapterSummary || '（无章节）'}

${customInstruction ? `额外要求：${customInstruction}` : ''}`;

  try {
    const config = getConfig();
    const prompt = buildPrompt({
      skillId: 'outline-analysis',
      sources: [],
      userMessage,
      customInstruction,
    });

    const provider = getProvider(config.provider);
    const messages = toMessages(prompt, [], skill.maxTokens);
    const result = await provider.chat(messages, {
      model: config.model,
      temperature: skill.temperature,
      maxTokens: skill.maxTokens,
    });

    let parsed;
    try {
      const jsonStr = result.content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsed = JSON.parse(jsonStr);
    } catch {
      return res.json({ success: false, error: 'AI 返回格式异常', raw: result.content });
    }

    res.json({ success: true, data: parsed });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'AI 请求失败';
    res.status(500).json({ success: false, error: message });
  }
});

export default router;
