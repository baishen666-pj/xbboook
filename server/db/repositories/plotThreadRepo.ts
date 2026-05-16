import { v4 as uuid } from 'uuid';
import { getDb } from '../database.js';
import type { PlotThread } from '../../types/index.js';

export function findByProject(projectId: string): PlotThread[] {
  const db = getDb();
  return db
    .prepare('SELECT * FROM plot_threads WHERE project_id = ? ORDER BY sort_order ASC')
    .all(projectId) as PlotThread[];
}

export function findByArc(arcId: string): PlotThread[] {
  const db = getDb();
  return db
    .prepare('SELECT * FROM plot_threads WHERE arc_id = ? ORDER BY sort_order ASC')
    .all(arcId) as PlotThread[];
}

export function findById(id: string): PlotThread | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM plot_threads WHERE id = ?').get(id) as PlotThread | undefined;
}

export function create(data: {
  projectId: string;
  arcId?: string;
  name: string;
  description?: string;
  status?: string;
  priority?: string;
}): PlotThread {
  const db = getDb();
  const id = uuid();
  const now = new Date().toISOString();

  const maxOrder = db
    .prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM plot_threads WHERE project_id = ?')
    .get(data.projectId) as { next: number };

  db.prepare(`
    INSERT INTO plot_threads (id, project_id, arc_id, name, description, status, priority, sort_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, data.projectId,
    data.arcId ?? null,
    data.name,
    data.description ?? null,
    data.status ?? 'open',
    data.priority ?? 'normal',
    maxOrder.next,
    now, now,
  );

  const created = findById(id);
  if (!created) throw new Error(`Failed to retrieve created plot thread: ${id}`);
  return created;
}

const THREAD_UPDATE_FIELDS = new Set(['arc_id', 'name', 'description', 'status', 'priority', 'sort_order']);

export function update(id: string, data: Partial<{
  arc_id: string | null;
  name: string;
  description: string;
  status: string;
  priority: string;
  sort_order: number;
}>): PlotThread | undefined {
  const db = getDb();
  const existing = findById(id);
  if (!existing) return undefined;

  const fields: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined && THREAD_UPDATE_FIELDS.has(key)) {
      fields.push(`${key} = ?`);
      values.push(value);
    }
  }

  if (fields.length === 0) return existing;

  fields.push("updated_at = datetime('now')");
  values.push(id);

  db.prepare(`UPDATE plot_threads SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return findById(id);
}

export function deleteById(id: string): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM plot_threads WHERE id = ?').run(id);
  return result.changes > 0;
}

export function reorder(items: { id: string; sortOrder: number }[]): void {
  const db = getDb();
  const stmt = db.prepare("UPDATE plot_threads SET sort_order = ?, updated_at = datetime('now') WHERE id = ?");
  db.transaction(() => {
    for (const item of items) stmt.run(item.sortOrder, item.id);
  })();
}