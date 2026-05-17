import { v4 as uuid } from 'uuid';
import { getDb } from '../database.js';

export interface TurningPoint {
  id: string;
  project_id: string;
  chapter_id: string | null;
  title: string;
  description: string | null;
  turn_type: string;
  severity: string;
  foreshadow_planted: number;
  foreshadow_resolved: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

const UPDATE_FIELDS = new Set([
  'title', 'description', 'chapter_id', 'turn_type', 'severity',
  'foreshadow_planted', 'foreshadow_resolved', 'sort_order',
]);

export function findByProject(projectId: string): TurningPoint[] {
  const db = getDb();
  return db
    .prepare('SELECT * FROM plot_turning_points WHERE project_id = ? ORDER BY sort_order ASC, created_at ASC')
    .all(projectId) as TurningPoint[];
}

export function findById(id: string): TurningPoint | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM plot_turning_points WHERE id = ?').get(id) as TurningPoint | undefined;
}

export function create(data: {
  projectId: string;
  title: string;
  chapterId?: string;
  description?: string;
  turnType?: string;
  severity?: string;
}): TurningPoint {
  const db = getDb();
  const id = uuid();
  const now = new Date().toISOString();

  const maxOrder = db
    .prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM plot_turning_points WHERE project_id = ?')
    .get(data.projectId) as { next: number };

  db.prepare(`
    INSERT INTO plot_turning_points (id, project_id, chapter_id, title, description, turn_type, severity, sort_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, data.projectId, data.chapterId ?? null, data.title,
    data.description ?? null, data.turnType ?? 'reversal',
    data.severity ?? 'major', maxOrder.next, now, now,
  );

  const created = findById(id);
  if (!created) throw new Error(`Failed to retrieve created turning point: ${id}`);
  return created;
}

export function update(id: string, data: Partial<{
  title: string;
  description: string;
  chapter_id: string | null;
  turn_type: string;
  severity: string;
  foreshadow_planted: number;
  foreshadow_resolved: number;
  sort_order: number;
}>): TurningPoint | undefined {
  const db = getDb();
  const existing = findById(id);
  if (!existing) return undefined;

  const fields: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined && UPDATE_FIELDS.has(key)) {
      fields.push(`${key} = ?`);
      values.push(value);
    }
  }

  if (fields.length === 0) return existing;

  fields.push("updated_at = datetime('now')");
  values.push(id);

  db.prepare(`UPDATE plot_turning_points SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return findById(id);
}

export function deleteById(id: string): boolean {
  const db = getDb();
  const existing = findById(id);
  if (!existing) return false;
  db.prepare('DELETE FROM plot_turning_points WHERE id = ?').run(id);
  return true;
}
