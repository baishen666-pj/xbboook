import { Router } from 'express';
import { getDb } from '../db/database.js';

const router = Router({ mergeParams: true });

router.get('/overview', (req, res) => {
  const { projectId } = req.params as { projectId: string };

  try {
    const db = getDb();

    const totalWords = db.prepare(`
      SELECT COALESCE(SUM(words_added), 0) as total
      FROM daily_stats
      WHERE project_id = ?
    `).get(projectId) as { total: number };

    const dayStats = db.prepare(`
      SELECT COUNT(DISTINCT date) as totalDays
      FROM daily_stats
      WHERE project_id = ? AND words_added > 0
    `).get(projectId) as { totalDays: number };

    const avgDaily = dayStats.totalDays > 0
      ? Math.round(totalWords.total / dayStats.totalDays)
      : 0;

    const streakRows = db.prepare(`
      SELECT date FROM daily_stats
      WHERE project_id = ? AND words_added > 0
      ORDER BY date DESC
    `).all(projectId) as Array<{ date: string }>;

    let longestStreak = 0;
    let currentStreak = 0;
    let prevDate: Date | null = null;

    for (const row of streakRows) {
      const d = new Date(row.date);
      if (prevDate === null) {
        currentStreak = 1;
      } else {
        const diff = (prevDate.getTime() - d.getTime()) / (1000 * 60 * 60 * 24);
        if (Math.abs(diff - 1) < 0.5) {
          currentStreak++;
        } else {
          longestStreak = Math.max(longestStreak, currentStreak);
          currentStreak = 1;
        }
      }
      prevDate = d;
    }
    longestStreak = Math.max(longestStreak, currentStreak);

    res.json({
      success: true,
      data: {
        totalWords: totalWords.total,
        totalDays: dayStats.totalDays,
        avgDailyWords: avgDaily,
        longestStreak,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取总览统计失败';
    res.status(500).json({ success: false, error: message });
  }
});

router.get('/trend', (req, res) => {
  const { projectId } = req.params as { projectId: string };
  const period = req.query.period === 'month' ? 'month' : 'week';

  try {
    const db = getDb();
    const days = period === 'month' ? 30 : 7;

    const rows = db.prepare(`
      SELECT date, words_added, writing_time_ms, chapters_worked
      FROM daily_stats
      WHERE project_id = ?
        AND date >= date('now', '-' || ? || ' days')
      ORDER BY date ASC
    `).all(projectId, days) as Array<{
      date: string;
      words_added: number;
      writing_time_ms: number;
      chapters_worked: number;
    }>;

    res.json({ success: true, data: rows });
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取趋势数据失败';
    res.status(500).json({ success: false, error: message });
  }
});

router.get('/heatmap', (req, res) => {
  const { projectId } = req.params as { projectId: string };

  try {
    const db = getDb();

    const rows = db.prepare(`
      SELECT
        CAST(strftime('%H', started_at) AS INTEGER) as hour,
        COUNT(*) as session_count,
        COALESCE(SUM(words_end - words_start), 0) as total_words,
        COALESCE(SUM(duration_ms), 0) as total_duration_ms
      FROM writing_sessions
      WHERE project_id = ? AND ended_at IS NOT NULL
      GROUP BY hour
      ORDER BY hour
    `).all(projectId) as Array<{
      hour: number;
      session_count: number;
      total_words: number;
      total_duration_ms: number;
    }>;

    const heatmap = Array.from({ length: 24 }, (_, hour) => {
      const match = rows.find(r => r.hour === hour);
      return {
        hour,
        sessionCount: match?.session_count || 0,
        totalWords: match?.total_words || 0,
        totalDurationMs: match?.total_duration_ms || 0,
      };
    });

    res.json({ success: true, data: heatmap });
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取热力图数据失败';
    res.status(500).json({ success: false, error: message });
  }
});

export default router;
