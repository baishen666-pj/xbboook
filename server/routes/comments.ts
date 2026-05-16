import { Router } from 'express';
import { z } from 'zod';
import * as commentRepo from '../db/repositories/commentRepo.js';
import * as userRepo from '../db/repositories/userRepo.js';
import { validate } from '../middleware/validate.js';
import { validateToken } from '../ws/presenceManager.js';

const router = Router({ mergeParams: true });

const createSchema = z.object({
  content: z.string().min(1).max(2000),
  selectionFrom: z.number().int().optional(),
  selectionTo: z.number().int().optional(),
  selectionText: z.string().max(500).optional(),
});

const updateSchema = z.object({
  content: z.string().min(1).max(2000),
});

router.get('/', (req, res) => {
  const { chapterId } = req.params as { chapterId: string };
  const comments = commentRepo.findByChapter(chapterId);
  const withUsers = comments.map((c) => {
    const user = userRepo.findById(c.user_id);
    return { ...c, displayName: user?.display_name ?? '未知', avatarColor: user?.avatar_color ?? '#6366f1' };
  });
  res.json({ success: true, data: withUsers });
});

router.post('/', validate(createSchema), (req, res) => {
  const { projectId, chapterId } = req.params as { projectId: string; chapterId: string };
  const authHeader = req.headers.authorization;
  let userId: string | null = null;
  if (authHeader?.startsWith('Bearer ')) {
    userId = validateToken(authHeader.slice(7));
  }
  if (!userId) {
    res.status(401).json({ success: false, error: '未认证' });
    return;
  }
  const comment = commentRepo.create({
    chapterId,
    projectId,
    userId,
    content: req.body.content,
    selectionFrom: req.body.selectionFrom,
    selectionTo: req.body.selectionTo,
    selectionText: req.body.selectionText,
  });
  const user = userRepo.findById(userId);
  res.json({ success: true, data: { ...comment, displayName: user?.display_name ?? '未知', avatarColor: user?.avatar_color ?? '#6366f1' } });
});

router.put('/:commentId', validate(updateSchema), (req, res) => {
  const { commentId } = req.params as { commentId: string };
  const updated = commentRepo.updateContent(commentId, req.body.content);
  if (!updated) {
    res.status(404).json({ success: false, error: '批注不存在' });
    return;
  }
  res.json({ success: true, data: updated });
});

router.put('/:commentId/resolve', (req, res) => {
  const { commentId } = req.params as { commentId: string };
  const resolved = commentRepo.resolve(commentId);
  if (!resolved) {
    res.status(404).json({ success: false, error: '批注不存在' });
    return;
  }
  res.json({ success: true, data: resolved });
});

router.delete('/:commentId', (req, res) => {
  const { commentId } = req.params as { commentId: string };
  const removed = commentRepo.remove(commentId);
  if (!removed) {
    res.status(404).json({ success: false, error: '批注不存在' });
    return;
  }
  res.json({ success: true });
});

export default router;
