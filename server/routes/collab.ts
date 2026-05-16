import { Router } from 'express';
import { z } from 'zod';
import * as memberRepo from '../db/repositories/memberRepo.js';
import * as lockManager from '../ws/lockManager.js';
import * as presenceManager from '../ws/presenceManager.js';
import * as userRepo from '../db/repositories/userRepo.js';
import * as projectRepo from '../db/repositories/projectRepo.js';
import { validate } from '../middleware/validate.js';

const router = Router({ mergeParams: true });

const addMemberSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(['writer', 'viewer']).optional(),
});

const lockBodySchema = z.object({
  userId: z.string().min(1),
});

function verifyToken(req: { headers: { authorization?: string } }): string | null {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return null;
  return presenceManager.validateToken(auth.slice(7));
}

router.get('/members', (req, res) => {
  const { projectId } = req.params as { projectId: string };
  const members = memberRepo.getMembers(projectId);
  res.json({ success: true, data: members });
});

router.post('/members', validate(addMemberSchema), (req, res) => {
  const { projectId } = req.params as { projectId: string };
  const callerId = verifyToken(req);
  if (!callerId) {
    res.status(401).json({ success: false, error: '未认证' });
    return;
  }

  const project = projectRepo.findById(projectId);
  if (!project) {
    res.status(404).json({ success: false, error: '项目不存在' });
    return;
  }

  const existingCount = memberRepo.getMembers(projectId).length;
  if (existingCount === 0) {
    memberRepo.addMember(projectId, req.body.userId, 'owner');
  } else {
    const callerRole = memberRepo.getMemberRole(projectId, callerId);
    if (callerRole !== 'owner') {
      res.status(403).json({ success: false, error: '仅项目拥有者可添加成员' });
      return;
    }
    memberRepo.addMember(projectId, req.body.userId, req.body.role ?? 'writer');
  }

  presenceManager.broadcastToProject(projectId, {
    type: 'member:joined',
    payload: { userId: req.body.userId },
  });

  res.json({ success: true, data: { projectId, userId: req.body.userId } });
});

router.delete('/members/:targetUserId', (req, res) => {
  const { projectId, targetUserId } = req.params as { projectId: string; targetUserId: string };
  const callerId = verifyToken(req);
  if (!callerId) {
    res.status(401).json({ success: false, error: '未认证' });
    return;
  }
  const callerRole = memberRepo.getMemberRole(projectId, callerId);
  if (callerRole !== 'owner') {
    res.status(403).json({ success: false, error: '仅项目拥有者可移除成员' });
    return;
  }
  memberRepo.removeMember(projectId, targetUserId);
  presenceManager.broadcastToProject(projectId, {
    type: 'member:left',
    payload: { userId: targetUserId },
  });
  res.json({ success: true });
});

router.get('/online', (req, res) => {
  const { projectId } = req.params as { projectId: string };
  const online = presenceManager.getOnlineUsers(projectId);
  const withNames = online.map((u) => {
    const user = userRepo.findById(u.userId);
    return { userId: u.userId, displayName: user?.display_name ?? '未知', avatarColor: user?.avatar_color ?? '#6366f1' };
  });
  res.json({ success: true, data: withNames });
});

router.post('/lock/:chapterId', validate(lockBodySchema), (req, res) => {
  const params = req.params as { projectId: string; chapterId: string };
  const { projectId, chapterId } = params;
  const callerId = verifyToken(req);
  if (!callerId) {
    res.status(401).json({ success: false, error: '未认证' });
    return;
  }
  if (callerId !== req.body.userId) {
    res.status(403).json({ success: false, error: '只能为自己获取锁' });
    return;
  }

  const acquired = lockManager.acquireLock(chapterId, req.body.userId);
  if (!acquired) {
    const lock = lockManager.getLock(chapterId);
    const lockUser = lock ? userRepo.findById(lock.userId) : null;
    res.status(409).json({
      success: false,
      error: `章节已被 ${lockUser?.display_name ?? '其他用户'} 锁定`,
    });
    return;
  }

  presenceManager.broadcastToProject(projectId, {
    type: 'lock:acquired',
    payload: { chapterId, userId: req.body.userId },
  });

  res.json({ success: true, data: { chapterId, userId: req.body.userId } });
});

router.delete('/lock/:chapterId', (req, res) => {
  const { projectId, chapterId } = req.params as { projectId: string; chapterId: string };
  const callerId = verifyToken(req);
  if (!callerId) {
    res.status(401).json({ success: false, error: '未认证' });
    return;
  }
  const userId = (req.query.userId as string) ?? callerId;
  if (callerId !== userId) {
    res.status(403).json({ success: false, error: '只能释放自己的锁' });
    return;
  }

  lockManager.releaseLock(chapterId, userId);
  presenceManager.broadcastToProject(projectId, {
    type: 'lock:released',
    payload: { chapterId, userId },
  });

  res.json({ success: true });
});

router.get('/locks', (req, res) => {
  const { projectId } = req.params as { projectId: string };
  const locks = lockManager.getProjectLocks(projectId);
  const withNames = locks.map((l) => {
    const user = userRepo.findById(l.userId);
    return { ...l, displayName: user?.display_name ?? '未知' };
  });
  res.json({ success: true, data: withNames });
});

export default router;
