import { Router } from 'express';
import { z } from 'zod';
import * as repo from '../db/repositories/foreshadowingRepo.js';
import { validate } from '../middleware/validate.js';

const router = Router({ mergeParams: true });

const createForeshadowingSchema = z.object({
  title: z.string().min(1, '标题不能为空').max(200),
  description: z.string().max(50000).optional(),
  plant_chapter_id: z.string().optional(),
  expected_harvest_chapter_id: z.string().optional(),
  importance: z.enum(['critical', 'important', 'normal', 'minor']).default('normal'),
});

const updateForeshadowingSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(50000).nullable().optional(),
  plant_chapter_id: z.string().nullable().optional(),
  expected_harvest_chapter_id: z.string().nullable().optional(),
  actual_harvest_chapter_id: z.string().nullable().optional(),
  status: z.enum(['planted', 'harvested', 'forgotten']).optional(),
  importance: z.enum(['critical', 'important', 'normal', 'minor']).optional(),
});

// List foreshadowing (optionally filter by status)
router.get('/', (req, res) => {
  const { projectId } = req.params as { projectId: string };
  const { status } = req.query as { status?: string };

  if (status) {
    const items = repo.findByStatus(projectId, status);
    res.json({ success: true, data: items });
  } else {
    const items = repo.findAll(projectId);
    res.json({ success: true, data: items });
  }
});

// Create foreshadowing
router.post('/', validate(createForeshadowingSchema), (req, res) => {
  const { projectId } = req.params as { projectId: string };
  const item = repo.create({
    projectId,
    title: req.body.title,
    description: req.body.description,
    plantChapterId: req.body.plant_chapter_id,
    expectedHarvestChapterId: req.body.expected_harvest_chapter_id,
    importance: req.body.importance,
  });
  res.status(201).json({ success: true, data: item });
});

// Update foreshadowing
router.patch('/:id', validate(updateForeshadowingSchema), (req, res) => {
  const item = repo.update(req.params.id as string, req.body);
  if (!item) {
    res.status(404).json({ success: false, error: '伏笔不存在' });
    return;
  }
  res.json({ success: true, data: item });
});

// Delete foreshadowing
router.delete('/:id', (req, res) => {
  const deleted = repo.deleteById(req.params.id as string);
  if (!deleted) {
    res.status(404).json({ success: false, error: '伏笔不存在' });
    return;
  }
  res.json({ success: true, data: null });
});

export default router;