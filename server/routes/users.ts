import { Router } from 'express';
import { z } from 'zod';
import * as userRepo from '../db/repositories/userRepo.js';
import * as presenceManager from '../ws/presenceManager.js';
import * as userPreferenceRepo from '../db/repositories/userPreferenceRepo.js';
import { validate } from '../middleware/validate.js';

const router = Router();

const identifySchema = z.object({
  username: z.string().min(1).max(20),
  displayName: z.string().min(1).max(30),
  avatarColor: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
});

const COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316'];

router.post('/identify', validate(identifySchema), (req, res) => {
  let user = userRepo.findByUsername(req.body.username);
  if (!user) {
    const color = req.body.avatarColor ?? COLORS[Math.floor(Math.random() * COLORS.length)];
    user = userRepo.create({
      username: req.body.username,
      displayName: req.body.displayName,
      avatarColor: color,
    });
  }
  const token = presenceManager.generateToken(user.id);
  res.json({ success: true, data: { ...user, token } });
});

router.get('/me', (req, res) => {
  const userId = req.query.userId as string;
  if (!userId) {
    res.status(400).json({ success: false, error: 'userId 参数必填' });
    return;
  }
  const user = userRepo.findById(userId);
  if (!user) {
    res.status(404).json({ success: false, error: '用户不存在' });
    return;
  }
  res.json({ success: true, data: user });
});

router.get('/', (_req, res) => {
  const users = userRepo.getAll();
  res.json({ success: true, data: users });
});

// Get user preferences
router.get('/:userId/preferences', (req, res) => {
  const { userId } = req.params;
  const rows = userPreferenceRepo.getAll(userId);
  const preferences: Record<string, string> = {};
  for (const row of rows) {
    preferences[row.key] = row.value;
  }
  res.json({ success: true, data: preferences });
});

// Update user preferences (batch)
const preferencesSchema = z.object({
  preferences: z.record(z.string(), z.string()),
});

router.patch('/:userId/preferences', validate(preferencesSchema), (req, res) => {
  const { userId } = req.params;
  const { preferences } = req.body as { preferences: Record<string, string> };
  userPreferenceRepo.setBatch(userId, preferences);
  const rows = userPreferenceRepo.getAll(userId);
  const result: Record<string, string> = {};
  for (const row of rows) {
    result[row.key] = row.value;
  }
  res.json({ success: true, data: result });
});

export default router;
