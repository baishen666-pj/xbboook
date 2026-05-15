import { Router } from 'express';
import { z } from 'zod';
import * as outlineRepo from '../db/repositories/outlineRepo.js';
import { validate } from '../middleware/validate.js';

const router = Router({ mergeParams: true });

const createOutlineSchema = z.object({
  title: z.string().min(1, 'title is required').max(200),
  content: z.string().max(50000).optional(),
  level: z.number().int().min(0).max(10).optional(),
  parentId: z.string().uuid().nullable().optional(),
  targetRefId: z.string().uuid().nullable().optional(),
});

const updateOutlineSchema = z.object({
  level: z.number().int().min(0).max(10).optional(),
  parent_id: z.string().uuid().nullable().optional(),
  target_ref_id: z.string().uuid().nullable().optional(),
  title: z.string().min(1).max(200).optional(),
  content: z.string().max(50000).optional(),
  sort_order: z.number().int().min(0).optional(),
});

router.get('/', (req, res) => {
  const { projectId } = req.params as { projectId: string };
  const outlines = outlineRepo.findByProject(projectId);
  res.json({ success: true, data: outlines });
});

router.get('/:id', (req, res) => {
  const outline = outlineRepo.findById(req.params.id);
  if (!outline) {
    res.status(404).json({ success: false, error: '大纲不存在' });
    return;
  }
  const children = outlineRepo.findChildren(outline.project_id, req.params.id);
  res.json({ success: true, data: { outline, children } });
});

router.post('/', validate(createOutlineSchema), (req, res) => {
  const { projectId } = req.params as { projectId: string };
  const outline = outlineRepo.create({ projectId, ...req.body });
  res.status(201).json({ success: true, data: outline });
});

router.put('/:id', validate(updateOutlineSchema), (req, res) => {
  const outline = outlineRepo.update(req.params.id, req.body);
  if (!outline) {
    res.status(404).json({ success: false, error: '大纲不存在' });
    return;
  }
  res.json({ success: true, data: outline });
});

router.delete('/:id', (req, res) => {
  const deleted = outlineRepo.deleteById(req.params.id);
  if (!deleted) {
    res.status(404).json({ success: false, error: '大纲不存在' });
    return;
  }
  res.json({ success: true, data: null });
});

export default router;
