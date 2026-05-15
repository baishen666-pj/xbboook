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

    return findByDate(data.projectId, data.date)!;
  }

  const id = uuid();
  db.prepare(`
    INSERT INTO daily_stats (id, project_id, date, words_added, words_total, writing_time_ms, chapters_worked)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, data.projectId, data.date, data.wordsAdded, data.wordsTotal, data.writingTimeMs, data.chaptersWorked);

  return findByDate(data.projectId, data.date)!;
}
