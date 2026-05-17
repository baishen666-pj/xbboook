import { Router } from 'express';
import { z } from 'zod';
import * as depRepo from '../db/repositories/chapterDependencyRepo.js';
import { validate } from '../middleware/validate.js';

const router = Router({ mergeParams: true });

const createSchema = z.object({
  sourceChapterId: z.string().min(1),
  targetChapterId: z.string().min(1),
  dependencyType: z.enum(['plot', 'character', 'foreshadowing', 'timeline', 'worldview']).optional(),
  description: z.string().max(1000).optional(),
  strength: z.enum(['weak', 'normal', 'strong']).optional(),
});

const updateSchema = z.object({
  dependencyType: z.enum(['plot', 'character', 'foreshadowing', 'timeline', 'worldview']).optional(),
  description: z.string().max(1000).optional(),
  strength: z.enum(['weak', 'normal', 'strong']).optional(),
});

// List all dependencies for project
router.get('/', (req, res) => {
  const { projectId } = req.params;
  const deps = depRepo.findByProject(projectId);
  res.json({ success: true, data: deps });
});

// Get dependencies for a specific chapter
router.get('/chapter/:chapterId', (req, res) => {
  const deps = depRepo.findByChapter(req.params.chapterId);
  res.json({ success: true, data: deps });
});

// Get stats
router.get('/stats', (req, res) => {
  const stats = depRepo.getStats(req.params.projectId);
  res.json({ success: true, data: stats });
});

// Detect circular dependencies
router.get('/cycles', (req, res) => {
  const cycles = depRepo.detectCircularDependencies(req.params.projectId);
  res.json({ success: true, data: cycles });
});

// Create dependency
router.post('/', validate(createSchema), (req, res) => {
  const { projectId } = req.params;
  const body = req.body;

  if (body.sourceChapterId === body.targetChapterId) {
    return res.status(400).json({ success: false, error: '不能创建自依赖' });
  }

  const dep = depRepo.create({
    project_id: projectId,
    source_chapter_id: body.sourceChapterId,
    target_chapter_id: body.targetChapterId,
    dependency_type: body.dependencyType,
    description: body.description,
    strength: body.strength,
  });

  res.status(201).json({ success: true, data: dep });
});

// Update dependency
router.put('/:depId', validate(updateSchema), (req, res) => {
  const body = req.body;
  const updates: Record<string, unknown> = {};

  if (body.dependencyType !== undefined) updates.dependency_type = body.dependencyType;
  if (body.description !== undefined) updates.description = body.description;
  if (body.strength !== undefined) updates.strength = body.strength;

  const dep = depRepo.update(req.params.depId, updates);
  if (!dep) {
    return res.status(404).json({ success: false, error: '依赖关系不存在' });
  }
  res.json({ success: true, data: dep });
});

// Delete dependency
router.delete('/:depId', (req, res) => {
  const ok = depRepo.deleteById(req.params.depId);
  if (!ok) {
    return res.status(404).json({ success: false, error: '依赖关系不存在' });
  }
  res.json({ success: true, data: null });
});

export default router;
