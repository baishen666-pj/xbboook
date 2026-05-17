import { Router, type Request } from 'express';
import { z } from 'zod';
import { getDb } from '../db/database.js';
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
  tags: z.array(z.string()).optional(),
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

router.get('/tags', (req: Request<ChapterParams>, res) => {
  const { projectId } = req.params;
  const chapters = chapterRepo.findByProject(projectId);
  const tagSet = new Set<string>();
  for (const ch of chapters) {
    try {
      const tags = JSON.parse((ch as Record<string, unknown>).tags as string || '[]') as string[];
      for (const t of tags) tagSet.add(t);
    } catch {
      // skip invalid tags
    }
  }
  res.json({ success: true, data: [...tagSet].sort() });
});

router.get('/schedule', (req: Request<ChapterParams>, res) => {
  const { projectId } = req.params;
  const chapters = chapterRepo.findByProject(projectId);
  const schedule = chapters.map((ch) => ({
    id: ch.id,
    title: ch.title,
    word_count: ch.word_count,
    publish_status: ch.publish_status ?? 'draft',
    scheduled_at: ch.scheduled_at ?? null,
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

const batchScheduleSchema = z.object({
  chapterIds: z.array(z.string()).min(1).max(50),
  startDate: z.string(),
  intervalHours: z.number().min(1).max(168).default(24),
  authorNote: z.string().optional(),
});

router.post('/batch-schedule', validate(batchScheduleSchema), (req: Request<ChapterParams>, res) => {
  const { projectId } = req.params;
  const { chapterIds, startDate, intervalHours } = req.body;

  const chapters = chapterRepo.findByProject(projectId);
  const chapterMap = new Map(chapters.map((c) => [c.id, c]));
  const start = new Date(startDate);

  const scheduled: Array<{ id: string; title: string; scheduledAt: string }> = [];
  const errors: Array<{ id: string; error: string }> = [];

  for (let i = 0; i < chapterIds.length; i++) {
    const id = chapterIds[i];
    const ch = chapterMap.get(id);
    if (!ch) {
      errors.push({ id, error: '章节不存在' });
      continue;
    }

    const scheduledAt = new Date(start.getTime() + i * intervalHours * 3600_000);
    const updated = chapterRepo.update(id, {
      publish_status: 'scheduled',
      scheduled_at: scheduledAt.toISOString(),
    });

    if (updated) {
      scheduled.push({ id, title: ch.title, scheduledAt: scheduledAt.toISOString() });
    } else {
      errors.push({ id, error: '更新失败' });
    }
  }

  res.json({ success: true, data: { scheduled, errors } });
});

router.post('/publish-due', (req: Request<ChapterParams>, res) => {
  const { projectId } = req.params;
  const now = new Date().toISOString();
  const db = getDb();

  const due = db.prepare(`
    SELECT id, title, scheduled_at
    FROM chapters
    WHERE project_id = ? AND publish_status = 'scheduled' AND scheduled_at <= ?
    ORDER BY scheduled_at ASC
  `).all(projectId, now) as Array<{ id: string; title: string; scheduled_at: string }>;

  const published: string[] = [];
  for (const ch of due) {
    chapterRepo.update(ch.id, { publish_status: 'published' });
    published.push(ch.id);
  }

  res.json({ success: true, data: { published, count: published.length } });
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
  const body = { ...req.body };
  if (body.tags !== undefined) {
    body.tags = JSON.stringify(body.tags);
  }
  const chapter = chapterRepo.update(req.params.id, body);
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
