import { Router, type Request } from 'express';
import { z } from 'zod';
import * as projectRepo from '../db/repositories/projectRepo.js';
import { validate } from '../middleware/validate.js';

const router = Router();

const createSchema = z.object({
  name: z.string().min(1, '项目名称不能为空'),
  description: z.string().optional(),
  genre: z.string().optional(),
  writing_style: z.string().optional(),
  writing_mode: z.string().optional(),
  target_words: z.number().optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  genre: z.string().nullable().optional(),
  writing_style: z.string().nullable().optional(),
  writing_mode: z.string().optional(),
  target_words: z.number().nullable().optional(),
  status: z.string().optional(),
  sort_order: z.number().optional(),
});

router.get('/', (_req, res) => {
  const projects = projectRepo.findAll();
  res.json({ success: true, data: projects });
});

router.get('/:id', (req, res) => {
  const project = projectRepo.findById(req.params.id);
  if (!project) {
    res.status(404).json({ success: false, error: '项目不存在' });
    return;
  }
  res.json({ success: true, data: project });
});

router.post('/', validate(createSchema), (req, res) => {
  const project = projectRepo.create(req.body);
  res.status(201).json({ success: true, data: project });
});

router.put('/:id', validate(updateSchema), (req: Request<{ id: string }>, res) => {
  const project = projectRepo.update(req.params.id, req.body);
  if (!project) {
    res.status(404).json({ success: false, error: '项目不存在' });
    return;
  }
  res.json({ success: true, data: project });
});

router.delete('/:id', (req, res) => {
  const deleted = projectRepo.deleteById(req.params.id);
  if (!deleted) {
    res.status(404).json({ success: false, error: '项目不存在' });
    return;
  }
  res.json({ success: true });
});

export default router;
