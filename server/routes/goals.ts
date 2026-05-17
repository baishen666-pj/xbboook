import { Router } from 'express';
import { z } from 'zod';
import * as goalRepo from '../db/repositories/goalRepo.js';
import { validate } from '../middleware/validate.js';

const router = Router({ mergeParams: true });

const goalTypeSchema = z.enum(['daily', 'weekly', 'monthly', 'total']);

const createGoalSchema = z.object({
  type: goalTypeSchema,
  target_words: z.number().int().min(1),
  start_date: z.string().nullable().optional(),
  end_date: z.string().nullable().optional(),
});

const updateGoalSchema = z.object({
  type: goalTypeSchema.optional(),
  target_words: z.number().int().min(1).optional(),
  start_date: z.string().nullable().optional(),
  end_date: z.string().nullable().optional(),
  is_active: z.number().int().min(0).max(1).optional(),
});

router.get('/', (req, res) => {
  const { projectId } = req.params as { projectId: string };
  const goals = goalRepo.findActive(projectId);
  const progressList = goalRepo.getProgressForGoals(goals);
  res.json({ success: true, data: progressList });
});

router.get('/all', (req, res) => {
  const { projectId } = req.params as { projectId: string };
  const goals = goalRepo.findByProject(projectId);
  res.json({ success: true, data: goals });
});

router.get('/:id', (req, res) => {
  const { id } = req.params as { id: string };
  const goal = goalRepo.findById(id);
  if (!goal) {
    res.status(404).json({ success: false, error: '目标不存在' });
    return;
  }
  res.json({ success: true, data: goal });
});

router.get('/:id/progress', (req, res) => {
  const { id } = req.params as { id: string };
  const progress = goalRepo.getProgress(id);
  if (!progress) {
    res.status(404).json({ success: false, error: '目标不存在' });
    return;
  }
  res.json({ success: true, data: progress });
});

router.post('/', validate(createGoalSchema), (req, res) => {
  const { projectId } = req.params as { projectId: string };
  const goal = goalRepo.create({
    project_id: projectId,
    type: req.body.type,
    target_words: req.body.target_words,
    start_date: req.body.start_date,
    end_date: req.body.end_date,
  });
  res.json({ success: true, data: goal });
});

router.put('/:id', validate(updateGoalSchema), (req, res) => {
  const { id } = req.params as { id: string };
  const updated = goalRepo.update(id, req.body);
  if (!updated) {
    res.status(404).json({ success: false, error: '目标不存在' });
    return;
  }
  res.json({ success: true, data: updated });
});

router.delete('/:id', (req, res) => {
  const { id } = req.params as { id: string };
  const deleted = goalRepo.deleteById(id);
  if (!deleted) {
    res.status(404).json({ success: false, error: '目标不存在' });
    return;
  }
  res.json({ success: true, data: null });
});

export default router;
