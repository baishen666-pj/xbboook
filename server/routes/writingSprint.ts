import { Router } from 'express';
import { z } from 'zod';
import * as repo from '../db/repositories/sprintRepo.js';
import { validate } from '../middleware/validate.js';

const router = Router({ mergeParams: true });

const createSchema = z.object({
  type: z.enum(['pomodoro', 'sprint', 'marathon', 'custom']).default('pomodoro'),
  durationMinutes: z.number().min(1).max(480).default(25),
  targetWords: z.number().min(0).default(0),
});

router.get('/', (req, res) => {
  const sprints = repo.findByProject(req.params.projectId, req.query.status as string);
  res.json({ success: true, data: sprints });
});

router.post('/', validate(createSchema), (req, res) => {
  const sprint = repo.create({ id: crypto.randomUUID(), projectId: req.params.projectId, ...req.body });
  res.status(201).json({ success: true, data: sprint });
});

router.post('/:sprintId/start', (req, res) => {
  const sprint = repo.startSprint(req.params.sprintId);
  if (!sprint) return res.status(404).json({ success: false, error: 'Sprint不存在或无法启动' });
  res.json({ success: true, data: sprint });
});

router.post('/:sprintId/pause', (req, res) => {
  const sprint = repo.pauseSprint(req.params.sprintId);
  if (!sprint) return res.status(404).json({ success: false, error: 'Sprint不存在或无法暂停' });
  res.json({ success: true, data: sprint });
});

router.post('/:sprintId/resume', (req, res) => {
  const sprint = repo.resumeSprint(req.params.sprintId);
  if (!sprint) return res.status(404).json({ success: false, error: 'Sprint不存在或无法恢复' });
  res.json({ success: true, data: sprint });
});

router.post('/:sprintId/complete', validate(z.object({ actualWords: z.number().min(0), notes: z.string().optional() })), (req, res) => {
  const sprint = repo.completeSprint(req.params.sprintId, req.body.actualWords, req.body.notes);
  if (!sprint) return res.status(404).json({ success: false, error: 'Sprint不存在' });
  res.json({ success: true, data: sprint });
});

router.post('/:sprintId/abandon', (req, res) => {
  const sprint = repo.abandonSprint(req.params.sprintId);
  if (!sprint) return res.status(404).json({ success: false, error: 'Sprint不存在' });
  res.json({ success: true, data: sprint });
});

router.get('/stats', (req, res) => {
  const days = req.query.days ? parseInt(req.query.days as string) : 30;
  const stats = repo.getStats(req.params.projectId, days);
  res.json({ success: true, data: stats });
});

router.delete('/:sprintId', (req, res) => {
  if (!repo.remove(req.params.sprintId)) return res.status(404).json({ success: false, error: 'Sprint不存在' });
  res.json({ success: true });
});

export default router;
