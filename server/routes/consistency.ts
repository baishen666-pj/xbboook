import { Router } from 'express';
import { z } from 'zod';
import * as repo from '../db/repositories/consistencyIssueRepo.js';
import { scanProjectNames } from '../services/nameScanner.js';
import { AppError } from '../middleware/errors.js';

export const consistencyRouter = Router({ mergeParams: true });

const createSchema = z.object({
  chapterId: z.string().uuid().optional().nullable(),
  type: z.enum(['character_conflict', 'timeline_error', 'setting_conflict', 'plot_logic', 'detail_omission', 'foreshadowing_conflict', 'name_mismatch']),
  severity: z.enum(['critical', 'high', 'medium', 'low']).optional(),
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  suggestion: z.string().max(2000).optional(),
  status: z.enum(['open', 'acknowledged', 'fixed', 'dismissed']).optional(),
  source: z.enum(['ai', 'name_scanner', 'manual']).optional(),
});

const updateSchema = z.object({
  status: z.enum(['open', 'acknowledged', 'fixed', 'dismissed']).optional(),
  severity: z.enum(['critical', 'high', 'medium', 'low']).optional(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional(),
  suggestion: z.string().max(2000).optional(),
});

const bulkSchema = z.object({
  issues: z.array(z.object({
    chapterId: z.string().optional().nullable(),
    type: z.string(),
    severity: z.string().optional(),
    title: z.string(),
    description: z.string().optional(),
    suggestion: z.string().optional(),
  })).min(1).max(100),
});

// List issues
consistencyRouter.get('/', (req, res) => {
  const { projectId } = req.params as { projectId: string };
  const status = req.query.status as string | undefined;
  const issues = repo.findByProject(projectId, status);
  res.json({ success: true, data: issues });
});

// Get counts by status
consistencyRouter.get('/counts', (_req, res) => {
  const { projectId } = _req.params as { projectId: string };
  const counts = repo.countByStatus(projectId);
  res.json({ success: true, data: counts });
});

// Create issue
consistencyRouter.post('/', (req, res) => {
  const { projectId } = req.params as { projectId: string };
  const data = createSchema.parse(req.body);
  const issue = repo.create({ id: crypto.randomUUID(), projectId, ...data });
  res.status(201).json({ success: true, data: issue });
});

// Bulk create
consistencyRouter.post('/bulk', (req, res) => {
  const { projectId } = req.params as { projectId: string };
  const { issues } = bulkSchema.parse(req.body);
  const count = repo.bulkCreate(projectId, issues);
  res.status(201).json({ success: true, data: { count } });
});

// Scan names
consistencyRouter.post('/scan-names', (req, res) => {
  const { projectId } = req.params as { projectId: string };
  const chapterIds = req.body.chapterIds as string[] | undefined;
  const nameIssues = scanProjectNames(projectId, chapterIds);
  if (nameIssues.length > 0) {
    const bulkIssues = nameIssues.map((i) => ({
      chapterId: i.chapterId,
      type: i.type,
      severity: i.severity,
      title: i.title,
      description: i.description,
      suggestion: i.suggestion,
    }));
    const count = repo.bulkCreate(projectId, bulkIssues);
    res.json({ success: true, data: { issuesFound: nameIssues.length, saved: count } });
  } else {
    res.json({ success: true, data: { issuesFound: 0, saved: 0 } });
  }
});

// Update issue
consistencyRouter.put('/:id', (req, res) => {
  const { id } = req.params as { id: string };
  const data = updateSchema.parse(req.body);
  const issue = repo.update(id, data);
  if (!issue) throw new AppError(404, 'Issue not found');
  res.json({ success: true, data: issue });
});

// Delete issue
consistencyRouter.delete('/:id', (req, res) => {
  const { id } = req.params as { id: string };
  const ok = repo.remove(id);
  if (!ok) throw new AppError(404, 'Issue not found');
  res.json({ success: true, data: { deleted: true } });
});
