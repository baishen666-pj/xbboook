import { Router, type Request } from 'express';
import { z } from 'zod';
import * as storyArcRepo from '../db/repositories/storyArcRepo.js';
import * as plotThreadRepo from '../db/repositories/plotThreadRepo.js';
import { validate } from '../middleware/validate.js';

type ProjectParams = { projectId: string };
type ArcParams = { projectId: string; id: string };

const router = Router({ mergeParams: true });

// --- Story Arcs ---

const createArcSchema = z.object({
  name: z.string().min(1, '弧线名称不能为空'),
  description: z.string().optional(),
  startChapter: z.number().nullable().optional(),
  endChapter: z.number().nullable().optional(),
  status: z.enum(['planned', 'active', 'completed', 'abandoned']).optional(),
});

const updateArcSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  start_chapter: z.number().nullable().optional(),
  end_chapter: z.number().nullable().optional(),
  status: z.enum(['planned', 'active', 'completed', 'abandoned']).optional(),
  sort_order: z.number().optional(),
});

router.get('/arcs', (req: Request<ProjectParams>, res) => {
  const arcs = storyArcRepo.findByProject(req.params.projectId);
  res.json({ success: true, data: arcs });
});

router.post('/arcs', validate(createArcSchema), (req: Request<ProjectParams>, res) => {
  const arc = storyArcRepo.create({
    projectId: req.params.projectId,
    name: req.body.name,
    description: req.body.description,
    startChapter: req.body.startChapter ?? undefined,
    endChapter: req.body.endChapter ?? undefined,
    status: req.body.status,
  });
  res.status(201).json({ success: true, data: arc });
});

router.put('/arcs/:id', validate(updateArcSchema), (req: Request<ArcParams>, res) => {
  const arc = storyArcRepo.update(req.params.id, req.body);
  if (!arc) {
    res.status(404).json({ success: false, error: '弧线不存在' });
    return;
  }
  res.json({ success: true, data: arc });
});

router.delete('/arcs/:id', (req: Request<ArcParams>, res) => {
  const deleted = storyArcRepo.deleteById(req.params.id);
  if (!deleted) {
    res.status(404).json({ success: false, error: '弧线不存在' });
    return;
  }
  res.json({ success: true });
});

const reorderArcsSchema = z.object({
  items: z.array(z.object({ id: z.string(), sortOrder: z.number() })),
});

router.put('/arcs/reorder', validate(reorderArcsSchema), (req: Request<ProjectParams>, res) => {
  storyArcRepo.reorder(req.body.items);
  res.json({ success: true });
});

// --- Plot Threads ---

const createThreadSchema = z.object({
  arcId: z.string().nullable().optional(),
  name: z.string().min(1, '线索名称不能为空'),
  description: z.string().optional(),
  status: z.enum(['open', 'resolved', 'dormant', 'abandoned']).optional(),
  priority: z.enum(['critical', 'high', 'normal', 'low']).optional(),
});

const updateThreadSchema = z.object({
  arc_id: z.string().nullable().optional(),
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  status: z.enum(['open', 'resolved', 'dormant', 'abandoned']).optional(),
  priority: z.enum(['critical', 'high', 'normal', 'low']).optional(),
  sort_order: z.number().optional(),
});

router.get('/threads', (req: Request<ProjectParams>, res) => {
  const threads = plotThreadRepo.findByProject(req.params.projectId);
  res.json({ success: true, data: threads });
});

router.get('/arcs/:id/threads', (req: Request<ArcParams>, res) => {
  const threads = plotThreadRepo.findByArc(req.params.id);
  res.json({ success: true, data: threads });
});

router.post('/threads', validate(createThreadSchema), (req: Request<ProjectParams>, res) => {
  const thread = plotThreadRepo.create({
    projectId: req.params.projectId,
    arcId: req.body.arcId ?? undefined,
    name: req.body.name,
    description: req.body.description,
    status: req.body.status,
    priority: req.body.priority,
  });
  res.status(201).json({ success: true, data: thread });
});

router.put('/threads/:threadId', validate(updateThreadSchema), (req: Request<ProjectParams & { threadId: string }>, res) => {
  const thread = plotThreadRepo.update(req.params.threadId, req.body);
  if (!thread) {
    res.status(404).json({ success: false, error: '线索不存在' });
    return;
  }
  res.json({ success: true, data: thread });
});

router.delete('/threads/:threadId', (req: Request<ProjectParams & { threadId: string }>, res) => {
  const deleted = plotThreadRepo.deleteById(req.params.threadId);
  if (!deleted) {
    res.status(404).json({ success: false, error: '线索不存在' });
    return;
  }
  res.json({ success: true });
});

const reorderThreadsSchema = z.object({
  items: z.array(z.object({ id: z.string(), sortOrder: z.number() })),
});

router.put('/threads/reorder', validate(reorderThreadsSchema), (req: Request<ProjectParams>, res) => {
  plotThreadRepo.reorder(req.body.items);
  res.json({ success: true });
});

export default router;