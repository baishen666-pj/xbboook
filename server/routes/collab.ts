import { Router } from 'express';
import * as memberRepo from '../db/repositories/memberRepo.js';
import * as lockManager from '../ws/lockManager.js';
import * as presenceManager from '../ws/presenceManager.js';
import * as userRepo from '../db/repositories/userRepo.js';
import * as projectRepo from '../db/repositories/projectRepo.js';

const router = Router({ mergeParams: true });

router.get('/members', (req, res) => {
  const { projectId } = req.params as { projectId: string };
  const members = memberRepo.getMembers(projectId);
  res.json({ success: true, data: members });
});

router.post('/members', (req, res) => {
  const { projectId } = req.params as { projectId: string };
  const { userId, role } = req.body as { userId: string; role?: string };

  if (!userId) {
    res.status(400).json({ success: false, error: 'userId 必填' });
    return;
  }

  const project = projectRepo.findById(projectId);
  if (!project) {
    res.status(404).json({ success: false, error: '项目不存在' });
    return;
  }

  const existingCount = memberRepo.getMembers(projectId).length;
  if (existingCount === 0) {
    memberRepo.addMember(projectId, userId, 'owner');
  } else {
    memberRepo.addMember(projectId, userId, role ?? 'writer');
  }

  presenceManager.broadcastToProject(projectId, {
    type: 'member:joined',
    payload: { userId },
  });

  res.json({ success: true, data: { projectId, userId } });
});

router.delete('/members/:userId', (req, res) => {
  const { projectId, userId } = req.params as { projectId: string; userId: string };
  memberRepo.removeMember(projectId, userId);
  presenceManager.broadcastToProject(projectId, {
    type: 'member:left',
    payload: { userId },
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

router.post('/lock/:chapterId', (req, res) => {
  const params = req.params as { projectId: string; chapterId: string };
  const { projectId, chapterId } = params;
  const { userId } = req.body as { userId: string };

  if (!userId) {
    res.status(400).json({ success: false, error: 'userId 必填' });
    return;
  }

  const acquired = lockManager.acquireLock(chapterId, userId);
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
    payload: { chapterId, userId },
  });

  res.json({ success: true, data: { chapterId, userId } });
});

router.delete('/lock/:chapterId', (req, res) => {
  const { projectId, chapterId } = req.params as { projectId: string; chapterId: string };
  const { userId } = req.query as { userId: string };

  if (!userId) {
    res.status(400).json({ success: false, error: 'userId 必填' });
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
