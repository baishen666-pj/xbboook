import { Router } from 'express';
import { z } from 'zod';
import * as repo from '../db/repositories/snippetRepo.js';

const router = Router({ mergeParams: true });

const SNIPPET_CATEGORIES = ['fight', 'environment', 'emotion', 'dialogue', 'transition', 'custom'] as const;

const createSnippetSchema = z.object({
  name: z.string().min(1, '模板名称不能为空').max(100, '模板名称不能超过100字'),
  category: z.enum(SNIPPET_CATEGORIES).default('custom'),
  content: z.string().min(1, '模板内容不能为空').max(5000, '模板内容不能超过5000字'),
});

const updateSnippetSchema = z.object({
  name: z.string().min(1, '模板名称不能为空').max(100, '模板名称不能超过100字').optional(),
  category: z.enum(SNIPPET_CATEGORIES).optional(),
  content: z.string().min(1, '模板内容不能为空').max(5000, '模板内容不能超过5000字').optional(),
  sort_order: z.number().int().min(0).optional(),
});

// List snippets for a project (includes builtins)
router.get('/', (req, res) => {
  const { projectId } = req.params as { projectId: string };
  const { category } = req.query as { category?: string };

  let snippets;
  if (category && typeof category === 'string') {
    snippets = repo.findByCategory(projectId, category);
  } else {
    snippets = repo.findAll(projectId);
  }

  res.json(snippets);
});

// Create a custom snippet
router.post('/', (req, res) => {
  const { projectId } = req.params as { projectId: string };

  const parsed = createSnippetSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues.map((i) => i.message).join('; ') });
    return;
  }

  const snippet = repo.create({
    projectId,
    name: parsed.data.name,
    category: parsed.data.category,
    content: parsed.data.content,
  });

  res.status(201).json(snippet);
});

// Update a custom snippet
router.patch('/:id', (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: '无效的模板ID' });
    return;
  }

  const existing = repo.findById(id);
  if (!existing) {
    res.status(404).json({ error: '模板不存在' });
    return;
  }

  if (existing.is_builtin) {
    res.status(403).json({ error: '内置模板不可编辑' });
    return;
  }

  const parsed = updateSnippetSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues.map((i) => i.message).join('; ') });
    return;
  }

  const updated = repo.update(id, parsed.data);
  res.json(updated);
});

// Delete a custom snippet
router.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: '无效的模板ID' });
    return;
  }

  const existing = repo.findById(id);
  if (!existing) {
    res.status(404).json({ error: '模板不存在' });
    return;
  }

  if (existing.is_builtin) {
    res.status(403).json({ error: '内置模板不可删除' });
    return;
  }

  const deleted = repo.deleteById(id);
  if (!deleted) {
    res.status(500).json({ error: '删除失败' });
    return;
  }

  res.json({ success: true });
});

export default router;