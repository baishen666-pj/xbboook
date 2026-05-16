import { Router, type Request } from 'express';
import { z } from 'zod';
import * as chapterRepo from '../db/repositories/chapterRepo.js';
import { readChapter } from '../services/fileService.js';
import { validate } from '../middleware/validate.js';

type ChapterParams = { projectId: string; id: string };

const router = Router({ mergeParams: true });

const createSchema = z.object({
  title: z.string().min(1, '章节标题不能为空'),
  volumeId: z.string().nullable().optional(),
  summary: z.string().optional(),
});

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  volume_id: z.string().nullable().optional(),
  summary: z.string().nullable().optional(),
  status: z.enum(['draft', 'writing', 'revised', 'done']).optional(),
  sort_order: z.number().optional(),
  publish_status: z.enum(['draft', 'scheduled', 'published', 'archived']).optional(),
  scheduled_at: z.string().nullable().optional(),
});

const contentSchema = z.object({
  content: z.string(),
});

const reorderSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      volumeId: z.string().nullable().optional(),
      sortOrder: z.number(),
    }),
  ),
});

router.get('/', (req: Request<ChapterParams>, res) => {
  const { projectId } = req.params;
  const chapters = chapterRepo.findByProject(projectId);
  res.json({ success: true, data: chapters });
});

router.get('/schedule', (req: Request<ChapterParams>, res) => {
  const { projectId } = req.params;
  const chapters = chapterRepo.findByProject(projectId);
  const schedule = chapters.map((ch) => ({
    id: ch.id,
    title: ch.title,
    word_count: ch.word_count,
    publish_status: (ch as any).publish_status ?? 'draft',
    scheduled_at: (ch as any).scheduled_at ?? null,
    sort_order: ch.sort_order,
  }));
  res.json({ success: true, data: schedule });
});

const publishStatusSchema = z.object({
  publish_status: z.enum(['draft', 'scheduled', 'published', 'archived']),
  scheduled_at: z.string().nullable().optional(),
});

router.patch('/:id/publish-status', validate(publishStatusSchema), (req: Request<ChapterParams>, res) => {
  const chapter = chapterRepo.update(req.params.id, {
    publish_status: req.body.publish_status,
    scheduled_at: req.body.scheduled_at ?? null,
  });
  if (!chapter) {
    res.status(404).json({ success: false, error: '章节不存在' });
    return;
  }
  res.json({ success: true, data: chapter });
});

router.get('/:id', async (req, res) => {
  const chapter = chapterRepo.findById(req.params.id);
  if (!chapter) {
    res.status(404).json({ success: false, error: '章节不存在' });
    return;
  }
  const content = await readChapter(chapter.project_id, chapter.id);
  res.json({ success: true, data: { ...chapter, content } });
});

router.post('/', validate(createSchema), async (req: Request<ChapterParams>, res) => {
  const { projectId } = req.params;
  const chapter = await chapterRepo.create({ ...req.body, projectId });
  res.status(201).json({ success: true, data: chapter });
});

router.put('/reorder', validate(reorderSchema), (req, res) => {
  chapterRepo.reorder(req.body.items);
  res.json({ success: true });
});

router.put('/:id', validate(updateSchema), (req: Request<ChapterParams>, res) => {
  const chapter = chapterRepo.update(req.params.id, req.body);
  if (!chapter) {
    res.status(404).json({ success: false, error: '章节不存在' });
    return;
  }
  res.json({ success: true, data: chapter });
});

router.put('/:id/content', validate(contentSchema), async (req: Request<ChapterParams>, res) => {
  const chapter = await chapterRepo.updateContent(req.params.id, req.body.content);
  if (!chapter) {
    res.status(404).json({ success: false, error: '章节不存在' });
    return;
  }
  res.json({ success: true, data: chapter });
});

router.delete('/:id', async (req, res) => {
  const deleted = await chapterRepo.deleteById(req.params.id);
  if (!deleted) {
    res.status(404).json({ success: false, error: '章节不存在' });
    return;
  }
  res.json({ success: true });
});

export default router;
