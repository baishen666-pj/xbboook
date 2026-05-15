import { v4 as uuid } from 'uuid';
import { getDb } from '../database.js';
import type { DailyStat } from '../../types/index.js';

export function findByProject(projectId: string): DailyStat[] {
  const db = getDb();
  return db
    .prepare('SELECT * FROM daily_stats WHERE project_id = ? ORDER BY date DESC')
    .all(projectId) as DailyStat[];
}

export function findByDate(projectId: string, date: string): DailyStat | undefined {
  const db = getDb();
  return db
    .prepare('SELECT * FROM daily_stats WHERE project_id = ? AND date = ?')
    .get(projectId, date) as DailyStat | undefined;
}

export function getRecent(projectId: string, days: number = 30): DailyStat[] {
  const db = getDb();
  return db
    .prepare(`SELECT * FROM daily_stats WHERE project_id = ? AND date >= date('now', '-' || ? || ' days') ORDER BY date ASC`)
    .all(projectId, days) as DailyStat[];
}

export function getSummary(projectId: string): {
  totalWords: number;
  totalDays: number;
  avgDaily: number;
  bestDay: { date: string; words: number } | null;
} {
  const db = getDb();

  const total = db
    .prepare('SELECT COALESCE(SUM(words_added), 0) as total, COUNT(*) as days FROM daily_stats WHERE project_id = ?')
    .get(projectId) as { total: number; days: number };

  const best = db
    .prepare('SELECT date, words_added as words FROM daily_stats WHERE project_id = ? ORDER BY words_added DESC LIMIT 1')
    .get(projectId) as { date: string; words: number } | undefined;

  return {
    totalWords: total.total,
    totalDays: total.days,
    avgDaily: total.days > 0 ? Math.round(total.total / total.days) : 0,
    bestDay: best ? { date: best.date, words: best.words } : null,
  };
}

export function upsert(data: {
  projectId: string;
  date: string;
  wordsAdded: number;
  wordsTotal: number;
  writingTimeMs: number;
  chaptersWorked: number;
}): DailyStat {
  const db = getDb();
  const existing = findByDate(data.projectId, data.date);

  if (existing) {
    db.prepare(`
      UPDATE daily_stats SET
        words_added = words_added + ?,
        words_total = ?,
        writing_time_ms = writing_time_ms + ?,
        chapters_worked = chapters_worked + ?
      WHERE id = ?
    `).run(data.wordsAdded, data.wordsTotal, data.writingTimeMs, data.chaptersWorked, existing.id);

    const updated = findByDate(data.projectId, data.date);
    if (!updated) throw new Error(`Failed to retrieve updated stat for ${data.date}`);
    return updated;
  }

  const id = uuid();
  db.prepare(`
    INSERT INTO daily_stats (id, project_id, date, words_added, words_total, writing_time_ms, chapters_worked)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, data.projectId, data.date, data.wordsAdded, data.wordsTotal, data.writingTimeMs, data.chaptersWorked);

  const created = findByDate(data.projectId, data.date);
  if (!created) throw new Error(`Failed to retrieve created stat for ${data.date}`);
  return created;
}

export function getChapterStatusDistribution(projectId: string): { status: string; count: number }[] {
  const db = getDb();
  return db.prepare(`
    SELECT status, COUNT(*) as count FROM chapters WHERE project_id = ? GROUP BY status
  `).all(projectId) as { status: string; count: number }[];
}

export function getWritingStreak(projectId: string): { current: number; longest: number } {
  const db = getDb();
  const rows = db.prepare(`
    SELECT DISTINCT date FROM daily_stats
    WHERE project_id = ? AND words_added > 0
    ORDER BY date DESC
  `).all(projectId) as { date: string }[];

  if (rows.length === 0) return { current: 0, longest: 0 };

  let longest = 1;
  let currentStreak = 1;
  let prevDate = new Date(rows[0].date);

  for (let i = 1; i < rows.length; i++) {
    const curDate = new Date(rows[i].date);
    const diffDays = Math.round((prevDate.getTime() - curDate.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 1) {
      currentStreak++;
      longest = Math.max(longest, currentStreak);
    } else if (diffDays > 1) {
      currentStreak = 1;
    }
    prevDate = curDate;
  }

  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const current = (rows[0].date === today || rows[0].date === yesterday) ? currentStreak : 0;

  return { current, longest: Math.max(longest, currentStreak) };
}

export function getTargetProgress(projectId: string): { target: number; current: number; percentage: number } {
  const db = getDb();
  const project = db.prepare('SELECT target_words FROM projects WHERE id = ?').get(projectId) as { target_words: number | null } | undefined;
  const target = project?.target_words ?? 0;

  const total = db.prepare(
    'SELECT COALESCE(SUM(word_count), 0) as total FROM chapters WHERE project_id = ?'
  ).get(projectId) as { total: number };

  return {
    target,
    current: total.total,
    percentage: target > 0 ? Math.min(Math.round((total.total / target) * 100), 100) : 0,
  };
}
