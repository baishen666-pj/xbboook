import { v4 as uuid } from 'uuid';
import { getDb } from '../database.js';

export interface WritingGoal {
  id: string;
  project_id: string;
  type: 'daily' | 'weekly' | 'monthly' | 'total';
  target_words: number;
  start_date: string | null;
  end_date: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface GoalProgress {
  goal: WritingGoal;
  current_words: number;
  percentage: number;
}

export function findByProject(projectId: string): WritingGoal[] {
  const db = getDb();
  return db
    .prepare('SELECT * FROM writing_goals WHERE project_id = ? ORDER BY created_at DESC')
    .all(projectId) as WritingGoal[];
}

export function findActive(projectId: string): WritingGoal[] {
  const db = getDb();
  return db
    .prepare('SELECT * FROM writing_goals WHERE project_id = ? AND is_active = 1 ORDER BY created_at DESC')
    .all(projectId) as WritingGoal[];
}

export function findById(id: string): WritingGoal | undefined {
  const db = getDb();
  return db
    .prepare('SELECT * FROM writing_goals WHERE id = ?')
    .get(id) as WritingGoal | undefined;
}

export function create(data: {
  project_id: string;
  type: 'daily' | 'weekly' | 'monthly' | 'total';
  target_words: number;
  start_date?: string | null;
  end_date?: string | null;
}): WritingGoal {
  const db = getDb();
  const id = uuid();
  db.prepare(`
    INSERT INTO writing_goals (id, project_id, type, target_words, start_date, end_date)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, data.project_id, data.type, data.target_words, data.start_date ?? null, data.end_date ?? null);

  const created = findById(id);
  if (!created) throw new Error('Failed to retrieve created goal');
  return created;
}

export function update(id: string, data: {
  type?: 'daily' | 'weekly' | 'monthly' | 'total';
  target_words?: number;
  start_date?: string | null;
  end_date?: string | null;
  is_active?: number;
}): WritingGoal | undefined {
  const db = getDb();
  const existing = findById(id);
  if (!existing) return undefined;

  const sets: string[] = [];
  const values: unknown[] = [];

  if (data.type !== undefined) { sets.push('type = ?'); values.push(data.type); }
  if (data.target_words !== undefined) { sets.push('target_words = ?'); values.push(data.target_words); }
  if (data.start_date !== undefined) { sets.push('start_date = ?'); values.push(data.start_date); }
  if (data.end_date !== undefined) { sets.push('end_date = ?'); values.push(data.end_date); }
  if (data.is_active !== undefined) { sets.push('is_active = ?'); values.push(data.is_active); }

  if (sets.length > 0) {
    sets.push("updated_at = datetime('now')");
    values.push(id);
    db.prepare(`UPDATE writing_goals SET ${sets.join(', ')} WHERE id = ?`).run(...values);
  }

  return findById(id);
}

export function deleteById(id: string): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM writing_goals WHERE id = ?').run(id);
  return result.changes > 0;
}

function getDateRange(type: WritingGoal['type']): { start: string; end: string } {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  if (type === 'daily') {
    return { start: today, end: today };
  }

  if (type === 'weekly') {
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(now);
    monday.setDate(now.getDate() + mondayOffset);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return {
      start: monday.toISOString().slice(0, 10),
      end: sunday.toISOString().slice(0, 10),
    };
  }

  if (type === 'monthly') {
    const start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const end = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${lastDay}`;
    return { start, end };
  }

  return { start: '1970-01-01', end: today };
}

export function getProgress(goalId: string): GoalProgress | null {
  const db = getDb();
  const goal = findById(goalId);
  if (!goal) return null;

  let currentWords = 0;

  if (goal.type === 'total') {
    const row = db.prepare(
      'SELECT COALESCE(SUM(word_count), 0) as total FROM chapters WHERE project_id = ?'
    ).get(goal.project_id) as { total: number };
    currentWords = row.total;
  } else {
    const range = getDateRange(goal.type);
    const row = db.prepare(`
      SELECT COALESCE(SUM(words_added), 0) as total
      FROM daily_stats
      WHERE project_id = ? AND date >= ? AND date <= ?
    `).get(goal.project_id, range.start, range.end) as { total: number };
    currentWords = row.total;
  }

  const percentage = goal.target_words > 0
    ? Math.min(Math.round((currentWords / goal.target_words) * 100), 100)
    : 0;

  return { goal, current_words: currentWords, percentage };
}

export function getProgressForGoals(goals: WritingGoal[]): GoalProgress[] {
  return goals.map((goal) => {
    const progress = getProgress(goal.id);
    return progress ?? { goal, current_words: 0, percentage: 0 };
  });
}
