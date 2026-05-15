import { Router } from 'express';
import { z } from 'zod';
import * as wvRepo from '../db/repositories/worldviewRepo.js';
import { validate } from '../middleware/validate.js';

const router = Router({ mergeParams: true });

const createWorldviewSchema = z.object({
  category: z.string().min(1, 'category is required').max(100),
  title: z.string().min(1, 'title is required').max(200),
  content: z.string().max(50000).optional(),
});

const updateWorldviewSchema = z.object({
  category: z.string().min(1).max(100).optional(),
  title: z.string().min(1).max(200).optional(),
  content: z.string().max(50000).optional(),
  sort_order: z.number().int().min(0).optional(),
});

// List worldviews (optionally filter by category)
router.get('/', (req, res) => {
  const { projectId } = req.params as { projectId: string };
  const { category } = req.query as { category?: string };

  if (category) {
    const items = wvRepo.findByCategory(projectId, category);
    res.json({ success: true, data: items });
  } else {
    const items = wvRepo.findByProject(projectId);
    const categories = wvRepo.getCategories(projectId);
    res.json({ success: true, data: { items, categories } });
  }
});

// Get categories
router.get('/categories', (req, res) => {
  const { projectId } = req.params as { projectId: string };
  const categories = wvRepo.getCategories(projectId);
  res.json({ success: true, data: categories });
});

// Get single worldview
router.get('/:id', (req, res) => {
  const item = wvRepo.findById(req.params.id);
  if (!item) {
    res.status(404).json({ success: false, error: '设定不存在' });
    return;
  }
  res.json({ success: true, data: item });
});

// Create worldview
router.post('/', validate(createWorldviewSchema), (req, res) => {
  const { projectId } = req.params as { projectId: string };
  const item = wvRepo.create({ projectId, ...req.body });
  res.status(201).json({ success: true, data: item });
});

// Update worldview
router.put('/:id', validate(updateWorldviewSchema), (req, res) => {
  const item = wvRepo.update(req.params.id, req.body);
  if (!item) {
    res.status(404).json({ success: false, error: '设定不存在' });
    return;
  }
  res.json({ success: true, data: item });
});

// Delete worldview
router.delete('/:id', (req, res) => {
  const deleted = wvRepo.deleteById(req.params.id);
  if (!deleted) {
    res.status(404).json({ success: false, error: '设定不存在' });
    return;
  }
  res.json({ success: true, data: null });
});

export default router;
