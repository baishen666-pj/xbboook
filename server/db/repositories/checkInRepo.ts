import { v4 as uuid } from 'uuid';
import { getDb } from '../database.js';

export interface CheckIn {
  id: string;
  project_id: string;
  date: string;
  words_today: number;
  note: string | null;
  created_at: string;
}

export function findByProject(projectId: string): CheckIn[] {
  const db = getDb();
  return db
    .prepare('SELECT * FROM check_ins WHERE project_id = ? ORDER BY date DESC')
    .all(projectId) as CheckIn[];
}

export function findByDate(projectId: string, date: string): CheckIn | undefined {
  const db = getDb();
  return db
    .prepare('SELECT * FROM check_ins WHERE project_id = ? AND date = ?')
    .get(projectId, date) as CheckIn | undefined;
}

export function getCalendarData(projectId: string, year: number): CheckIn[] {
  const db = getDb();
  return db
    .prepare(`SELECT * FROM check_ins WHERE project_id = ? AND date >= ? AND date < ? ORDER BY date ASC`)
    .all(projectId, `${year}-01-01`, `${year + 1}-01-01`) as CheckIn[];
}

export function getRecentCheckIns(projectId: string, days: number = 30): CheckIn[] {
  const db = getDb();
  return db
    .prepare(`SELECT * FROM check_ins WHERE project_id = ? AND date >= date('now', '-' || ? || ' days') ORDER BY date DESC`)
    .all(projectId, days) as CheckIn[];
}

export function upsert(data: {
  projectId: string;
  date: string;
  wordsToday: number;
  note?: string;
}): CheckIn {
  const db = getDb();
  const existing = findByDate(data.projectId, data.date);

  if (existing) {
    db.prepare(`
      UPDATE check_ins SET words_today = ?, note = ? WHERE id = ?
    `).run(data.wordsToday, data.note ?? existing.note, existing.id);
    return findByDate(data.projectId, data.date)!;
  }

  const id = uuid();
  db.prepare(`
    INSERT INTO check_ins (id, project_id, date, words_today, note)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, data.projectId, data.date, data.wordsToday, data.note ?? null);

  return findByDate(data.projectId, data.date)!;
}

export function getCheckInStats(projectId: string): {
  totalCheckIns: number;
  totalWords: number;
  currentStreak: number;
  longestStreak: number;
} {
  const db = getDb();

  const totalRow = db.prepare(`
    SELECT COUNT(*) as count, COALESCE(SUM(words_today), 0) as total FROM check_ins WHERE project_id = ?
  `).get(projectId) as { count: number; total: number };

  const totalCheckIns = totalRow.count;
  const totalWords = totalRow.total;

  const rows = db.prepare(`
    SELECT date FROM check_ins
    WHERE project_id = ?
    ORDER BY date DESC
  `).all(projectId) as { date: string }[];

  if (rows.length === 0) {
    return { totalCheckIns, totalWords, currentStreak: 0, longestStreak: 0 };
  }

  let longestStreak = 1;
  let currentStreak = 1;

  for (let i = 1; i < rows.length; i++) {
    const prevDate = new Date(rows[i - 1].date);
    const curDate = new Date(rows[i].date);
    const diffDays = Math.round((prevDate.getTime() - curDate.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 1) {
      currentStreak++;
      longestStreak = Math.max(longestStreak, currentStreak);
    } else if (diffDays > 1) {
      currentStreak = 1;
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const current = (rows[0].date === today || rows[0].date === yesterday) ? currentStreak : 0;

  return { totalCheckIns, totalWords, currentStreak: current, longestStreak: Math.max(longestStreak, current) };
}
