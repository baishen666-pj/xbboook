import { getDb } from '../db/database.js';
import * as sessionRepo from '../db/repositories/sessionRepo.js';

export interface WritingTrend {
  label: string;
  words: number;
  sessions: number;
}

export interface AiUsageRate {
  totalWords: number;
  aiMessages: number;
  rate: number;
}

export interface WritingHabits {
  peakHours: { hour: number; count: number }[];
  consistencyScore: number;
  optimalSessionLength: number;
}

export interface Productivity {
  avgWordsPerSession: number;
  bestDay: { date: string; words: number } | null;
  avgIntervalDays: number;
}

export function getWritingTrends(projectId: string, period: 'week' | 'month' = 'week'): WritingTrend[] {
  const db = getDb();
  const days = period === 'week' ? 7 : 30;
  const rows = db.prepare(`
    SELECT date, words_added as words
    FROM daily_stats
    WHERE project_id = ? AND date >= date('now', '-' || ? || ' days')
    ORDER BY date ASC
  `).all(projectId, days) as { date: string; words: number }[];

  if (period === 'week') {
    return rows.map((r) => ({
      label: r.date.slice(5),
      words: r.words,
      sessions: 0,
    }));
  }

  const weeklyBuckets: WritingTrend[] = [];
  for (let i = 0; i < rows.length; i += 7) {
    const chunk = rows.slice(i, i + 7);
    const totalWords = chunk.reduce((s, r) => s + r.words, 0);
    const label = chunk[0]?.date?.slice(5) ?? '';
    weeklyBuckets.push({ label, words: totalWords, sessions: chunk.length });
  }
  return weeklyBuckets;
}

export function getAiUsageRate(projectId: string, period: 'week' | 'month' = 'week'): AiUsageRate {
  const db = getDb();
  const days = period === 'week' ? 7 : 30;

  const wordRow = db.prepare(`
    SELECT COALESCE(SUM(words_added), 0) as total
    FROM daily_stats
    WHERE project_id = ? AND date >= date('now', '-' || ? || ' days')
  `).get(projectId, days) as { total: number };

  const aiRow = db.prepare(`
    SELECT COUNT(*) as count
    FROM chat_messages
    WHERE project_id = ? AND role = 'assistant'
      AND created_at >= datetime('now', '-' || ? || ' days')
  `).get(projectId, days) as { count: number };

  const totalWords = wordRow.total;
  const aiMessages = aiRow.count;
  const rate = totalWords > 0 ? Math.round((aiMessages / totalWords) * 10000) / 100 : 0;

  return { totalWords, aiMessages, rate };
}

export function getWritingHabits(projectId: string): WritingHabits {
  const db = getDb();

  const peakHours = sessionRepo.getHourlyDistribution(projectId, 30);

  const activeDays = db.prepare(`
    SELECT COUNT(DISTINCT date) as count
    FROM daily_stats
    WHERE project_id = ? AND words_added > 0
      AND date >= date('now', '-30 days')
  `).get(projectId) as { count: number };

  const consistencyScore = Math.round((activeDays.count / 30) * 100);

  const sessionDurations = db.prepare(`
    SELECT duration_ms
    FROM writing_sessions
    WHERE project_id = ? AND ended_at IS NOT NULL AND duration_ms > 0
      AND started_at >= datetime('now', '-30 days')
    ORDER BY duration_ms DESC
    LIMIT 20
  `).all(projectId) as { duration_ms: number }[];

  const optimalSessionLength = sessionDurations.length > 0
    ? Math.round(sessionDurations.reduce((s, r) => s + r.duration_ms, 0) / sessionDurations.length / 60000)
    : 0;

  return { peakHours, consistencyScore, optimalSessionLength };
}

export function getProductivity(projectId: string): Productivity {
  const db = getDb();

  const sessionRow = db.prepare(`
    SELECT
      AVG(words_end - words_start) as avg_words,
      COUNT(*) as session_count
    FROM writing_sessions
    WHERE project_id = ? AND ended_at IS NOT NULL
      AND started_at >= datetime('now', '-30 days')
  `).get(projectId) as { avg_words: number; session_count: number };

  const avgWordsPerSession = sessionRow.session_count > 0
    ? Math.round(sessionRow.avg_words)
    : 0;

  const bestDay = db.prepare(`
    SELECT date, words_added as words
    FROM daily_stats
    WHERE project_id = ? AND words_added > 0
      AND date >= date('now', '-30 days')
    ORDER BY words_added DESC
    LIMIT 1
  `).get(projectId) as { date: string; words: number } | undefined;

  const dateRows = db.prepare(`
    SELECT DISTINCT date
    FROM daily_stats
    WHERE project_id = ? AND words_added > 0
      AND date >= date('now', '-30 days')
    ORDER BY date ASC
  `).all(projectId) as { date: string }[];

  let totalGap = 0;
  let gapCount = 0;
  for (let i = 1; i < dateRows.length; i++) {
    const prev = new Date(dateRows[i - 1].date);
    const curr = new Date(dateRows[i].date);
    const gap = Math.round((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));
    if (gap > 0) {
      totalGap += gap;
      gapCount++;
    }
  }
  const avgIntervalDays = gapCount > 0 ? Math.round(totalGap / gapCount) : 0;

  return {
    avgWordsPerSession,
    bestDay: bestDay ? { date: bestDay.date, words: bestDay.words } : null,
    avgIntervalDays,
  };
}
