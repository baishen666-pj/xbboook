import { Router, type Request } from 'express';
import { z } from 'zod';
import * as projectRepo from '../db/repositories/projectRepo.js';
import * as chapterRepo from '../db/repositories/chapterRepo.js';
import { validate } from '../middleware/validate.js';
import type { Project, Chapter } from '../types/index.js';

const router = Router();

interface ProjectEnriched extends Project {
  word_count: number;
  chapter_count: number;
}

const createSchema = z.object({
  name: z.string().min(1, '项目名称不能为空'),
  description: z.string().optional(),
  genre: z.string().optional(),
  writing_style: z.string().optional(),
  writing_mode: z.string().optional(),
  target_words: z.number().optional(),
  daily_target: z.number().optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  genre: z.string().nullable().optional(),
  writing_style: z.string().nullable().optional(),
  writing_mode: z.string().optional(),
  target_words: z.number().nullable().optional(),
  daily_target: z.number().optional(),
  status: z.enum(['active', 'archived', 'completed']).optional(),
  sort_order: z.number().optional(),
});

function enrichProject(project: Project): ProjectEnriched {
  const chapters: Chapter[] = chapterRepo.findByProject(project.id);
  return {
    ...project,
    word_count: chapters.reduce((sum, c) => sum + (c.word_count ?? 0), 0),
    chapter_count: chapters.length,
  };
}

router.get('/', (_req, res) => {
  const projects = projectRepo.findAll();
  res.json({ success: true, data: projects.map(enrichProject) });
});

router.get('/:id', (req, res) => {
  const project = projectRepo.findById(req.params.id);
  if (!project) {
    res.status(404).json({ success: false, error: '项目不存在' });
    return;
  }
  res.json({ success: true, data: enrichProject(project) });
});

router.post('/', validate(createSchema), async (req, res) => {
  const project = await projectRepo.create(req.body);
  res.status(201).json({ success: true, data: enrichProject(project) });
});

router.put('/:id', validate(updateSchema), (req: Request<{ id: string }>, res) => {
  const project = projectRepo.update(req.params.id, req.body);
  if (!project) {
    res.status(404).json({ success: false, error: '项目不存在' });
    return;
  }
  res.json({ success: true, data: enrichProject(project) });
});

router.delete('/:id', async (req, res) => {
  const deleted = await projectRepo.deleteById(req.params.id);
  if (!deleted) {
    res.status(404).json({ success: false, error: '项目不存在' });
    return;
  }
  res.json({ success: true });
});

export default router;
