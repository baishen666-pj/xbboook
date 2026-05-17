import { Router } from 'express';
import { z } from 'zod';
import * as chapterRepo from '../db/repositories/chapterRepo.js';
import * as volumeRepo from '../db/repositories/volumeRepo.js';
import { readChapter, writeChapter, deleteChapter } from '../services/fileService.js';
import { validate } from '../middleware/validate.js';

const router = Router({ mergeParams: true });

const splitSchema = z.object({
  chapterId: z.string().min(1),
  splitPoints: z.array(z.number().int().positive()).min(1).max(10),
});

const mergeSchema = z.object({
  chapterIds: z.array(z.string().min(1)).min(2).max(10),
  title: z.string().min(1).max(200).optional(),
});

// Split a chapter at given character positions
router.post('/split', validate(splitSchema), async (req, res) => {
  const { projectId } = req.params;
  const { chapterId, splitPoints } = req.body;

  const chapter = chapterRepo.findById(chapterId);
  if (!chapter || chapter.project_id !== projectId) {
    return res.status(404).json({ success: false, error: '章节不存在' });
  }

  const content = await readChapter(projectId, chapterId);

  const sortedPoints = [...splitPoints].sort((a: number, b: number) => a - b);
  const lastPoint = sortedPoints[sortedPoints.length - 1];
  if (lastPoint >= content.length) {
    return res.status(400).json({ success: false, error: '拆分点超出文本范围' });
  }

  const parts: string[] = [];
  let prev = 0;
  for (const pt of sortedPoints) {
    parts.push(content.slice(prev, pt));
    prev = pt;
  }
  parts.push(content.slice(prev));

  const results = [];
  for (let i = 0; i < parts.length; i++) {
    const partContent = parts[i].trim();
    if (!partContent) continue;

    if (i === 0) {
      // Update the original chapter with first part
      await chapterRepo.updateContent(chapterId, partContent);
      chapterRepo.update(chapterId, {
        title: i === 0 ? chapter.title : `${chapter.title} (${i + 1})`,
      });
      results.push({ id: chapterId, title: chapter.title, words: partContent.length });
    } else {
      // Create new chapters for remaining parts
      const newChapter = await chapterRepo.create({
        projectId,
        title: `${chapter.title} (${i + 1})`,
        volumeId: chapter.volume_id ?? undefined,
      });
      await chapterRepo.updateContent(newChapter.id, partContent);
      results.push({ id: newChapter.id, title: newChapter.title, words: partContent.length });
    }
  }

  res.json({ success: true, data: { splitCount: results.length, chapters: results } });
});

// Merge multiple chapters into one
router.post('/merge', validate(mergeSchema), async (req, res) => {
  const { projectId } = req.params;
  const { chapterIds, title } = req.body;

  const chapters = chapterIds
    .map((id: string) => chapterRepo.findById(id))
    .filter((c: any) => c && c.project_id === projectId);

  if (chapters.length < 2) {
    return res.status(400).json({ success: false, error: '至少需要2个有效章节' });
  }

  // Read all contents in order
  const contents: string[] = [];
  for (const ch of chapters) {
    const content = await readChapter(projectId, ch.id);
    if (content.trim()) {
      contents.push(content.trim());
    }
  }

  const mergedContent = contents.join('\n\n');
  const mergedTitle = title ?? chapters.map((c: any) => c.title).join(' + ');

  // Update first chapter with merged content
  await chapterRepo.updateContent(chapters[0].id, mergedContent);
  chapterRepo.update(chapters[0].id, { title: mergedTitle });

  // Delete the rest
  for (let i = 1; i < chapters.length; i++) {
    await chapterRepo.deleteById(chapters[i].id);
  }

  res.json({
    success: true,
    data: {
      id: chapters[0].id,
      title: mergedTitle,
      words: mergedContent.length,
      mergedCount: chapters.length,
    },
  });
});

export default router;
