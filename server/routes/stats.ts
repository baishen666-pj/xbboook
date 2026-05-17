import { Router } from 'express';
import { z } from 'zod';
import { getDb } from '../db/database.js';
import * as statsRepo from '../db/repositories/statsRepo.js';
import * as sessionRepo from '../db/repositories/sessionRepo.js';
import * as analyticsService from '../services/analyticsService.js';
import { analyzeContent } from '../services/contentAnalysis.js';
import { readChapter } from '../services/fileService.js';
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

router.get('/today', (req, res) => {
  const { projectId } = req.params as { projectId: string };
  const today = new Date().toISOString().slice(0, 10);
  const db = getDb();

  const todayWords = db.prepare(`
    SELECT COALESCE(SUM(words_end - words_start), 0) as words,
           COALESCE(SUM(duration_ms), 0) as duration_ms,
           COUNT(*) as sessions
    FROM writing_sessions
    WHERE project_id = ? AND DATE(started_at) = ? AND ended_at IS NOT NULL
  `).get(projectId, today) as { words: number; duration_ms: number; sessions: number };

  const project = db.prepare('SELECT daily_target FROM projects WHERE id = ?').get(projectId) as { daily_target: number } | undefined;

  res.json({
    success: true,
    data: {
      words: todayWords.words,
      durationMs: todayWords.duration_ms,
      sessions: todayWords.sessions,
      dailyTarget: project?.daily_target ?? 0,
    },
  });
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

router.get('/sessions', (req, res) => {
  const { projectId } = req.params as { projectId: string };
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
  const sessions = sessionRepo.getRecentSessions(projectId, limit);

  const db = getDb();
  const enriched = sessions.map((s) => {
    const chapter = db.prepare('SELECT title FROM chapters WHERE id = ?').get(s.chapter_id) as { title: string } | undefined;
    return {
      ...s,
      chapterTitle: chapter?.title ?? '未知章节',
      wordsDelta: s.words_end - s.words_start,
    };
  });

  res.json({ success: true, data: enriched });
});

router.get('/content-analysis', async (req, res) => {
  const { projectId } = req.params as { projectId: string };
  const chapterId = req.query.chapterId as string | undefined;

  const db = getDb();

  if (chapterId) {
    try {
      const content = await readChapter(projectId, chapterId);
      const analysis = analyzeContent(content);
      res.json({ success: true, data: analysis });
    } catch {
      res.json({ success: true, data: analyzeContent('') });
    }
    return;
  }

  // Analyze all chapters
  const chapters = db.prepare(
    'SELECT id FROM chapters WHERE project_id = ? ORDER BY sort_order'
  ).all(projectId) as Array<{ id: string }>;

  const allContent: string[] = [];
  for (const ch of chapters) {
    try {
      const content = await readChapter(projectId, ch.id);
      allContent.push(content);
    } catch {
      // skip unreadable chapters
    }
  }

  const analysis = analyzeContent(allContent.join('\n\n'));
  res.json({ success: true, data: analysis });
});

export default router;
