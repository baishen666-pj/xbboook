import { Router } from 'express';
import { z } from 'zod';
import * as sceneRepo from '../db/repositories/sceneRepo.js';
import { validate } from '../middleware/validate.js';

const router = Router({ mergeParams: true });

const createSceneSchema = z.object({
  title: z.string().min(1).max(200),
  summary: z.string().max(2000).optional(),
  contentStartOffset: z.number().int().min(0).optional(),
  contentEndOffset: z.number().int().min(0).optional(),
  tags: z.array(z.string()).optional(),
  mood: z.string().max(50).optional(),
  location: z.string().max(200).optional(),
  timeOfDay: z.string().max(50).optional(),
  povCharacterId: z.string().nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
  status: z.enum(['draft', 'writing', 'revising', 'done']).optional(),
  wordCount: z.number().int().min(0).optional(),
  notes: z.string().max(5000).optional(),
  chapterId: z.string().min(1),
});

const updateSceneSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  summary: z.string().max(2000).optional(),
  contentStartOffset: z.number().int().min(0).optional(),
  contentEndOffset: z.number().int().min(0).optional(),
  tags: z.array(z.string()).optional(),
  mood: z.string().max(50).optional(),
  location: z.string().max(200).optional(),
  timeOfDay: z.string().max(50).optional(),
  povCharacterId: z.string().nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
  status: z.enum(['draft', 'writing', 'revising', 'done']).optional(),
  wordCount: z.number().int().min(0).optional(),
  notes: z.string().max(5000).optional(),
  chapterId: z.string().min(1).optional(),
});

const reorderSchema = z.object({
  sceneIds: z.array(z.string().min(1)).min(1),
});

// List scenes for a project
router.get('/', (req, res) => {
  const { projectId } = req.params;
  const scenes = sceneRepo.findByProjectWithPov(projectId);
  res.json({ success: true, data: scenes });
});

// Get scenes for a specific chapter
router.get('/chapter/:chapterId', (req, res) => {
  const { chapterId } = req.params;
  const scenes = sceneRepo.findByChapter(chapterId);
  res.json({ success: true, data: scenes });
});

// Get scene stats
router.get('/stats', (req, res) => {
  const { projectId } = req.params;
  const stats = sceneRepo.getStatsByProject(projectId);
  res.json({ success: true, data: stats });
});

// Get single scene
router.get('/:sceneId', (req, res) => {
  const scene = sceneRepo.findByIdWithPov(req.params.sceneId);
  if (!scene) {
    return res.status(404).json({ success: false, error: '场景不存在' });
  }
  res.json({ success: true, data: scene });
});

// Create scene
router.post('/', validate(createSceneSchema), (req, res) => {
  const { projectId } = req.params;
  const body = req.body;
  const scene = sceneRepo.create({
    chapter_id: body.chapterId,
    project_id: projectId,
    title: body.title,
    summary: body.summary,
    content_start_offset: body.contentStartOffset,
    content_end_offset: body.contentEndOffset,
    tags: JSON.stringify(body.tags ?? []),
    mood: body.mood,
    location: body.location,
    time_of_day: body.timeOfDay,
    pov_character_id: body.povCharacterId ?? null,
    sort_order: body.sortOrder,
    status: body.status,
    word_count: body.wordCount,
    notes: body.notes,
  });
  res.status(201).json({ success: true, data: scene });
});

// Update scene
router.put('/:sceneId', validate(updateSceneSchema), (req, res) => {
  const body = req.body;
  const updates: Record<string, unknown> = {};

  if (body.title !== undefined) updates.title = body.title;
  if (body.summary !== undefined) updates.summary = body.summary;
  if (body.contentStartOffset !== undefined) updates.content_start_offset = body.contentStartOffset;
  if (body.contentEndOffset !== undefined) updates.content_end_offset = body.contentEndOffset;
  if (body.tags !== undefined) updates.tags = JSON.stringify(body.tags);
  if (body.mood !== undefined) updates.mood = body.mood;
  if (body.location !== undefined) updates.location = body.location;
  if (body.timeOfDay !== undefined) updates.time_of_day = body.timeOfDay;
  if (body.povCharacterId !== undefined) updates.pov_character_id = body.povCharacterId;
  if (body.sortOrder !== undefined) updates.sort_order = body.sortOrder;
  if (body.status !== undefined) updates.status = body.status;
  if (body.wordCount !== undefined) updates.word_count = body.wordCount;
  if (body.notes !== undefined) updates.notes = body.notes;

  const scene = sceneRepo.update(req.params.sceneId, updates);
  if (!scene) {
    return res.status(404).json({ success: false, error: '场景不存在' });
  }
  res.json({ success: true, data: scene });
});

// Delete scene
router.delete('/:sceneId', (req, res) => {
  const ok = sceneRepo.deleteById(req.params.sceneId);
  if (!ok) {
    return res.status(404).json({ success: false, error: '场景不存在' });
  }
  res.json({ success: true, data: null });
});

// Reorder scenes
router.post('/reorder', validate(reorderSchema), (req, res) => {
  sceneRepo.reorder(req.body.sceneIds);
  res.json({ success: true, data: null });
});

export default router;
