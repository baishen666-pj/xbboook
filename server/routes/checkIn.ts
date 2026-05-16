import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import * as checkInRepo from '../db/repositories/checkInRepo.js';
import * as achievementRepo from '../db/repositories/achievementRepo.js';
import { getDb } from '../db/database.js';

const router = Router({ mergeParams: true });

const checkInSchema = z.object({
  note: z.string().max(500).optional(),
});

router.get('/calendar', (req, res) => {
  const { projectId } = req.params as { projectId: string };
  const year = Number(req.query.year) || new Date().getFullYear();
  const data = checkInRepo.getCalendarData(projectId, year);
  res.json({ success: true, data });
});

router.get('/stats', (req, res) => {
  const { projectId } = req.params as { projectId: string };
  const stats = checkInRepo.getCheckInStats(projectId);
  res.json({ success: true, data: stats });
});

router.post('/', validate(checkInSchema), async (req, res) => {
  const { projectId } = req.params as { projectId: string };
  const today = new Date().toISOString().slice(0, 10);

  const db = getDb();

  // Calculate today's words from writing sessions
  const todayWords = db.prepare(`
    SELECT COALESCE(SUM(words_end - words_start), 0) as words
    FROM writing_sessions
    WHERE project_id = ? AND DATE(started_at) = ? AND ended_at IS NOT NULL
  `).get(projectId, today) as { words: number };

  // If no sessions, use daily_stats
  const words = todayWords.words || (() => {
    const stat = db.prepare(`
      SELECT COALESCE(words_added, 0) as words FROM daily_stats
      WHERE project_id = ? AND date = ?
    `).get(projectId, today) as { words: number } | undefined;
    return stat?.words ?? 0;
  })();

  const checkIn = checkInRepo.upsert({
    projectId,
    date: today,
    wordsToday: words,
    note: req.body.note,
  });

  // Check for new achievements
  const projectStats = checkInRepo.getCheckInStats(projectId);
  const totalWords = (db.prepare(
    'SELECT COALESCE(SUM(word_count), 0) as total FROM chapters WHERE project_id = ?'
  ).get(projectId) as { total: number }).total;

  const chapterCount = (db.prepare(
    'SELECT COUNT(*) as count FROM chapters WHERE project_id = ?'
  ).get(projectId) as { count: number }).count;

  const newAchievements = achievementRepo.checkAndAward(projectId, {
    totalWords,
    chapterCount,
    checkInCount: projectStats.totalCheckIns,
    currentStreak: projectStats.currentStreak,
  });

  res.json({
    success: true,
    data: {
      checkIn,
      newAchievements,
    },
  });
});

router.get('/recent', (req, res) => {
  const { projectId } = req.params as { projectId: string };
  const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 365);
  const data = checkInRepo.getRecentCheckIns(projectId, days);
  res.json({ success: true, data });
});

export default router;
