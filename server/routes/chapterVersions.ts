import { Router } from 'express';
import { z } from 'zod';
import * as versionRepo from '../db/repositories/chapterVersionRepo.js';
import { chapterRepo } from '../db/repositories/chapterRepo.js';
import { validate } from '../middleware/validate.js';

const router = Router({ mergeParams: true });

// List versions for a chapter or project
router.get('/', (req, res) => {
  const { projectId } = req.params;
  const { chapterId } = req.query as { chapterId?: string };
  const versions = chapterId
    ? versionRepo.findByChapter(chapterId)
    : versionRepo.findByProject(projectId);
  res.json({ success: true, data: versions });
});

// Create snapshot
router.post('/', validate(z.object({
  chapterId: z.string(),
  type: z.enum(['manual', 'auto', 'milestone']).default('manual'),
  note: z.string().optional(),
})), (req, res) => {
  const { projectId } = req.params;
  const { chapterId, type, note } = req.body;
  const chapter = chapterRepo.findById(chapterId);
  if (!chapter) return res.status(404).json({ success: false, error: '章节不存在' });

  const snapshot = versionRepo.create({
    chapter_id: chapterId,
    project_id: projectId,
    title: chapter.title,
    content: chapter.content || '',
    word_count: (chapter.content || '').length,
    snapshot_type: type,
    note: note || null,
  });
  res.json({ success: true, data: snapshot });
});

// Get version
router.get('/:id', (req, res) => {
  const snapshot = versionRepo.findById(req.params.id);
  if (!snapshot) return res.status(404).json({ success: false, error: '版本不存在' });
  res.json({ success: true, data: snapshot });
});

// Diff two versions
router.get('/diff/:id1/:id2', (req, res) => {
  const { id1, id2 } = req.params;
  const diff = versionRepo.getDiff(id1, id2);
  if (!diff) return res.status(404).json({ success: false, error: '版本不存在' });
  res.json({ success: true, data: diff });
});

// Rollback to version
router.post('/:id/rollback', async (req, res) => {
  const snapshot = versionRepo.findById(req.params.id);
  if (!snapshot) return res.status(404).json({ success: false, error: '版本不存在' });

  const chapter = chapterRepo.findById(snapshot.chapter_id);
  if (!chapter) return res.status(404).json({ success: false, error: '章节不存在' });

  // Create snapshot of current state before rollback
  versionRepo.create({
    chapter_id: snapshot.chapter_id,
    project_id: snapshot.project_id,
    title: chapter.title + ' (回滚前)',
    content: chapter.content || '',
    word_count: (chapter.content || '').length,
    snapshot_type: 'auto',
    note: `回滚前自动备份，目标版本: ${snapshot.id}`,
  });

  chapterRepo.update(snapshot.chapter_id, {
    title: snapshot.title,
  });
  await chapterRepo.updateContent(snapshot.chapter_id, snapshot.content);

  res.json({ success: true, data: { rolledBackTo: snapshot.id } });
});

// Delete version
router.delete('/:id', (req, res) => {
  const ok = versionRepo.remove(req.params.id);
  res.json({ success: ok });
});

export default router;
