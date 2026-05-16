import { Router } from 'express';
import { z } from 'zod';
import * as statsRepo from '../db/repositories/statsRepo.js';
import * as sessionRepo from '../db/repositories/sessionRepo.js';
import * as analyticsService from '../services/analyticsService.js';
import { validate } from '../middleware/validate.js';

const router = Router({ mergeParams: true });

const createStatSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
  wordsAdded: z.number().int().min(0),
  wordsTotal: z.number().int().min(0).optional(),
  writingTimeMs: z.number().int().min(0).optional(),
  chaptersWorked: z.number().int().min(0).optional(),
});

const startSessionSchema = z.object({
  chapterId: z.string().min(1),
  wordsStart: z.number().int().min(0),
});

const endSessionSchema = z.object({
  wordsEnd: z.number().int().min(0),
});

router.get('/', (req, res) => {
  const { projectId } = req.params as { projectId: string };
  const summary = statsRepo.getSummary(projectId);
  const recent = statsRepo.getRecent(projectId, 30);
  res.json({ success: true, data: { summary, recent } });
});

router.get('/recent', (req, res) => {
  const { projectId } = req.params as { projectId: string };
  const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 365);
  const recent = statsRepo.getRecent(projectId, days);
  res.json({ success: true, data: recent });
});

router.get('/dashboard', (req, res) => {
  const { projectId } = req.params as { projectId: string };
  const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 365);
  const data = analyticsService.getDashboardData(projectId, days);
  res.json({ success: true, data });
});

router.get('/characters', async (req, res) => {
  const { projectId } = req.params as { projectId: string };
  try {
    const data = await analyticsService.getCharacterAppearances(projectId);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : '获取角色数据失败' });
  }
});

router.post('/', validate(createStatSchema), (req, res) => {
  const { projectId } = req.params as { projectId: string };
  const stat = statsRepo.upsert({
    projectId,
    date: req.body.date,
    wordsAdded: req.body.wordsAdded,
    wordsTotal: req.body.wordsTotal ?? 0,
    writingTimeMs: req.body.writingTimeMs ?? 0,
    chaptersWorked: req.body.chaptersWorked ?? 0,
  });
  res.json({ success: true, data: stat });
});

router.post('/session', validate(startSessionSchema), (req, res) => {
  const { projectId } = req.params as { projectId: string };
  const session = sessionRepo.create({
    projectId,
    chapterId: req.body.chapterId,
    startedAt: new Date().toISOString(),
    wordsStart: req.body.wordsStart,
  });
  res.json({ success: true, data: session });
});

router.put('/session/:sessionId', validate(endSessionSchema), (req, res) => {
  const { sessionId } = req.params as { sessionId: string };
  const session = sessionRepo.endSession(sessionId, req.body.wordsEnd);
  if (!session) {
    res.status(404).json({ success: false, error: '会话不存在' });
    return;
  }
  res.json({ success: true, data: session });
});

export default router;
