import { getDb } from '../database.js';

export interface WritingSprint {
  id: string;
  projectId: string;
  userId: string;
  type: 'pomodoro' | 'sprint' | 'marathon' | 'custom';
  durationMinutes: number;
  targetWords: number;
  actualWords: number;
  status: 'planned' | 'active' | 'paused' | 'completed' | 'abandoned';
  startedAt: string | null;
  endedAt: string | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface SprintStats {
  id: string;
  projectId: string;
  userId: string;
  date: string;
  totalSprints: number;
  totalMinutes: number;
  totalWords: number;
  bestWpm: number;
  createdAt: string;
}

const SPRINT_FIELDS = 'id, project_id, user_id, type, duration_minutes, target_words, actual_words, status, started_at, ended_at, notes, created_at, updated_at';

function mapSprint(row: Record<string, unknown>): WritingSprint {
  return {
    id: row.id as string,
    projectId: row.project_id as string,
    userId: (row.user_id as string) || 'default',
    type: row.type as WritingSprint['type'],
    durationMinutes: row.duration_minutes as number,
    targetWords: row.target_words as number,
    actualWords: row.actual_words as number,
    status: row.status as WritingSprint['status'],
    startedAt: row.started_at as string | null,
    endedAt: row.ended_at as string | null,
    notes: (row.notes as string) || '',
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export function findByProject(projectId: string, status?: string): WritingSprint[] {
  const db = getDb();
  if (status) {
    return (db.prepare(`SELECT ${SPRINT_FIELDS} FROM writing_sprints WHERE project_id = ? AND status = ? ORDER BY created_at DESC`).all(projectId, status) as Record<string, unknown>[]).map(mapSprint);
  }
  return (db.prepare(`SELECT ${SPRINT_FIELDS} FROM writing_sprints WHERE project_id = ? ORDER BY created_at DESC LIMIT 50`).all(projectId) as Record<string, unknown>[]).map(mapSprint);
}

export function findById(id: string): WritingSprint | undefined {
  const db = getDb();
  const row = db.prepare(`SELECT ${SPRINT_FIELDS} FROM writing_sprints WHERE id = ?`).get(id) as Record<string, unknown> | undefined;
  return row ? mapSprint(row) : undefined;
}

export function create(data: { id: string; projectId: string; userId?: string; type: string; durationMinutes: number; targetWords?: number }): WritingSprint {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO writing_sprints (id, project_id, user_id, type, duration_minutes, target_words, actual_words, status, started_at, ended_at, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 0, 'planned', NULL, NULL, '', ?, ?)`).run(
    data.id, data.projectId, data.userId ?? 'default', data.type, data.durationMinutes, data.targetWords ?? 0, now, now,
  );
  return findById(data.id)!;
}

export function startSprint(id: string): WritingSprint | undefined {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare("UPDATE writing_sprints SET status = 'active', started_at = ?, updated_at = ? WHERE id = ? AND status = 'planned'").run(now, now, id);
  return findById(id);
}

export function pauseSprint(id: string): WritingSprint | undefined {
  const db = getDb();
  db.prepare("UPDATE writing_sprints SET status = 'paused', updated_at = ? WHERE id = ? AND status = 'active'").run(new Date().toISOString(), id);
  return findById(id);
}

export function resumeSprint(id: string): WritingSprint | undefined {
  const db = getDb();
  db.prepare("UPDATE writing_sprints SET status = 'active', updated_at = ? WHERE id = ? AND status = 'paused'").run(new Date().toISOString(), id);
  return findById(id);
}

export function completeSprint(id: string, actualWords: number, notes?: string): WritingSprint | undefined {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare("UPDATE writing_sprints SET status = 'completed', actual_words = ?, ended_at = ?, notes = ?, updated_at = ? WHERE id = ?").run(
    actualWords, now, notes ?? '', now, id,
  );
  updateSprintStats(findById(id)!);
  return findById(id);
}

export function abandonSprint(id: string): WritingSprint | undefined {
  const db = getDb();
  db.prepare("UPDATE writing_sprints SET status = 'abandoned', ended_at = ?, updated_at = ? WHERE id = ?").run(
    new Date().toISOString(), new Date().toISOString(), id,
  );
  return findById(id);
}

function updateSprintStats(sprint: WritingSprint): void {
  const db = getDb();
  const date = new Date().toISOString().split('T')[0];
  const duration = sprint.endedAt && sprint.startedAt
    ? (new Date(sprint.endedAt).getTime() - new Date(sprint.startedAt).getTime()) / 60000
    : sprint.durationMinutes;
  const wpm = duration > 0 ? sprint.actualWords / duration : 0;
  const existing = db.prepare('SELECT id, total_sprints, total_minutes, total_words, best_wpm FROM sprint_stats WHERE project_id = ? AND user_id = ? AND date = ?').get(sprint.projectId, sprint.userId, date) as Record<string, unknown> | undefined;
  if (existing) {
    const newTotal = (existing.total_sprints as number) + 1;
    const newMinutes = (existing.total_minutes as number) + Math.round(duration);
    const newWords = (existing.total_words as number) + sprint.actualWords;
    const newBest = Math.max((existing.best_wpm as number) || 0, wpm);
    db.prepare('UPDATE sprint_stats SET total_sprints = ?, total_minutes = ?, total_words = ?, best_wpm = ? WHERE id = ?').run(newTotal, newMinutes, newWords, newBest, existing.id as string);
  } else {
    db.prepare('INSERT INTO sprint_stats (id, project_id, user_id, date, total_sprints, total_minutes, total_words, best_wpm, created_at) VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?)').run(
      crypto.randomUUID(), sprint.projectId, sprint.userId, date, Math.round(duration), sprint.actualWords, wpm, new Date().toISOString(),
    );
  }
}

export function getStats(projectId: string, days?: number): SprintStats[] {
  const db = getDb();
  if (days) {
    const since = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];
    return (db.prepare('SELECT * FROM sprint_stats WHERE project_id = ? AND date >= ? ORDER BY date DESC').all(projectId, since) as Record<string, unknown>[]).map(r => ({
      id: r.id as string, projectId: r.project_id as string, userId: (r.user_id as string) || 'default',
      date: r.date as string, totalSprints: r.total_sprints as number, totalMinutes: r.total_minutes as number,
      totalWords: r.total_words as number, bestWpm: (r.best_wpm as number) || 0, createdAt: r.created_at as string,
    }));
  }
  return (db.prepare('SELECT * FROM sprint_stats WHERE project_id = ? ORDER BY date DESC LIMIT 30').all(projectId) as Record<string, unknown>[]).map(r => ({
    id: r.id as string, projectId: r.project_id as string, userId: (r.user_id as string) || 'default',
    date: r.date as string, totalSprints: r.total_sprints as number, totalMinutes: r.total_minutes as number,
    totalWords: r.total_words as number, bestWpm: (r.best_wpm as number) || 0, createdAt: r.created_at as string,
  }));
}

export function remove(id: string): boolean {
  const db = getDb();
  return db.prepare('DELETE FROM writing_sprints WHERE id = ?').run(id).changes > 0;
}
