import { v4 as uuid } from 'uuid';
import { getDb } from '../database.js';

export interface WritingSessionRow {
  id: string;
  project_id: string;
  chapter_id: string;
  started_at: string;
  ended_at: string | null;
  words_start: number;
  words_end: number;
  duration_ms: number;
}

export function create(data: {
  projectId: string;
  chapterId: string;
  startedAt: string;
  wordsStart: number;
}): WritingSessionRow {
  const db = getDb();
  const id = uuid();
  db.prepare(`
    INSERT INTO writing_sessions (id, project_id, chapter_id, started_at, words_start)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, data.projectId, data.chapterId, data.startedAt, data.wordsStart);

  return findById(id)!;
}

export function findById(id: string): WritingSessionRow | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM writing_sessions WHERE id = ?').get(id) as WritingSessionRow | undefined;
}

export function endSession(id: string, wordsEnd: number): WritingSessionRow | undefined {
  const db = getDb();
  const session = findById(id);
  if (!session) return undefined;

  const endedAt = new Date().toISOString();
  const durationMs = new Date(endedAt).getTime() - new Date(session.started_at).getTime();

  db.prepare(`
    UPDATE writing_sessions SET ended_at = ?, words_end = ?, duration_ms = ? WHERE id = ?
  `).run(endedAt, wordsEnd, durationMs, id);

  return findById(id);
}

export function getRecentSessions(projectId: string, limit = 50): WritingSessionRow[] {
  const db = getDb();
  return db.prepare(
    'SELECT * FROM writing_sessions WHERE project_id = ? ORDER BY started_at DESC LIMIT ?'
  ).all(projectId, limit) as WritingSessionRow[];
}

export function getHourlyDistribution(projectId: string, days = 30): { hour: number; count: number }[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT CAST(strftime('%H', started_at) AS INTEGER) as hour, COUNT(*) as count
    FROM writing_sessions
    WHERE project_id = ? AND started_at >= datetime('now', '-' || ? || ' days')
    GROUP BY hour ORDER BY hour
  `).all(projectId, days) as { hour: number; count: number }[];

  const result: { hour: number; count: number }[] = [];
  for (let h = 0; h < 24; h++) {
    const found = rows.find(r => r.hour === h);
    result.push({ hour: h, count: found?.count ?? 0 });
  }
  return result;
}

export function getDailyWritingStats(projectId: string, days = 30): { date: string; words: number; sessions: number }[] {
  const db = getDb();
  return db.prepare(`
    SELECT
      DATE(started_at) as date,
      SUM(words_end - words_start) as words,
      COUNT(*) as sessions
    FROM writing_sessions
    WHERE project_id = ? AND ended_at IS NOT NULL
      AND started_at >= datetime('now', '-' || ? || ' days')
    GROUP BY DATE(started_at) ORDER BY date ASC
  `).all(projectId, days) as { date: string; words: number; sessions: number }[];
}
