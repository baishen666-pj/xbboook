import { Router } from 'express';
import * as repo from '../db/repositories/promptTemplateRepo.js';
import { BUILTIN_TEMPLATES } from '../ai/builtinTemplates.js';

const router = Router();

// List templates (optionally filter by category or search)
router.get('/', (req, res) => {
  const { category, search } = req.query as { category?: string; search?: string };

  if (search) {
    res.json({ success: true, data: repo.search(search) });
    return;
  }

  res.json({ success: true, data: repo.findAll(category) });
});

// Get single template
router.get('/:id', (req, res) => {
  const t = repo.findById(req.params.id);
  if (!t) {
    res.status(404).json({ success: false, error: '模板不存在' });
    return;
  }
  res.json({ success: true, data: t });
});

// Create template
router.post('/', (req, res) => {
  const { name, description, category, systemPrompt, userPromptTemplate, suggestedTemperature, suggestedMaxTokens, tags } = req.body as {
    name?: string; description?: string; category?: string; systemPrompt?: string;
    userPromptTemplate?: string; suggestedTemperature?: number; suggestedMaxTokens?: number; tags?: string[];
  };

  if (!name || !systemPrompt) {
    res.status(400).json({ success: false, error: 'name 和 systemPrompt 必填' });
    return;
  }

  const t = repo.create({ name, description, category, systemPrompt, userPromptTemplate, suggestedTemperature, suggestedMaxTokens, tags });
  res.json({ success: true, data: t });
});

// Use template (increment usage count)
router.post('/:id/use', (req, res) => {
  const t = repo.findById(req.params.id);
  if (!t) {
    res.status(404).json({ success: false, error: '模板不存在' });
    return;
  }
  repo.incrementUsage(req.params.id);
  res.json({ success: true, data: t });
});

// Initialize built-in templates
router.post('/init-builtin', (_req, res) => {
  const existing = repo.findBuiltin();
  if (existing.length > 0) {
    res.json({ success: true, data: existing, message: '内置模板已存在' });
    return;
  }

  const created = BUILTIN_TEMPLATES.map(t =>
    repo.create({
      name: t.name,
      description: t.description,
      category: t.category,
      systemPrompt: t.systemPrompt,
      suggestedTemperature: t.suggestedTemperature,
      suggestedMaxTokens: t.suggestedMaxTokens,
      isBuiltin: true,
      tags: t.tags,
    }),
  );

  res.json({ success: true, data: created });
});

// Update template
router.patch('/:id', (req, res) => {
  const t = repo.findById(req.params.id);
  if (!t) {
    res.status(404).json({ success: false, error: '模板不存在' });
    return;
  }
  if (t.is_builtin) {
    res.status(400).json({ success: false, error: '内置模板不可修改' });
    return;
  }
  repo.update(req.params.id, req.body as Parameters<typeof repo.update>[1]);
  res.json({ success: true, data: repo.findById(req.params.id) });
});

// Delete template
router.delete('/:id', (req, res) => {
  repo.deleteById(req.params.id);
  res.json({ success: true });
});

export default router;
