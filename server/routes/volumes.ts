import { Router, type Request } from 'express';
import { z } from 'zod';
import * as volumeRepo from '../db/repositories/volumeRepo.js';
import { validate } from '../middleware/validate.js';

type VolumeParams = { projectId: string; id: string };

const router = Router({ mergeParams: true });

const createSchema = z.object({
  title: z.string().min(1, '卷标题不能为空'),
  summary: z.string().optional(),
});

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  summary: z.string().nullable().optional(),
  sort_order: z.number().optional(),
});

router.get('/', (req: Request<VolumeParams>, res) => {
  const { projectId } = req.params;
  const volumes = volumeRepo.findByProject(projectId);
  res.json({ success: true, data: volumes });
});

router.post('/', validate(createSchema), (req: Request<VolumeParams>, res) => {
  const projectId = req.params.projectId!;
  const volume = volumeRepo.create({ ...req.body, projectId });
  res.status(201).json({ success: true, data: volume });
});

router.put('/:id', validate(updateSchema), (req: Request<VolumeParams>, res) => {
  const volume = volumeRepo.update(req.params.id, req.body);
  if (!volume) {
    res.status(404).json({ success: false, error: '卷不存在' });
    return;
  }
  res.json({ success: true, data: volume });
});

router.delete('/:id', (req, res) => {
  const deleted = volumeRepo.deleteById(req.params.id);
  if (!deleted) {
    res.status(404).json({ success: false, error: '卷不存在' });
    return;
  }
  res.json({ success: true });
});

const reorderSchema = z.object({
  items: z.array(z.object({ id: z.string(), sortOrder: z.number() })),
});

router.put('/reorder', validate(reorderSchema), (req, res) => {
  volumeRepo.reorder(req.body.items);
  res.json({ success: true });
});

export default router;
