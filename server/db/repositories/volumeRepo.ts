import { v4 as uuid } from 'uuid';
import { getDb } from '../database.js';
import type { Volume } from '../../types/index.js';

export function findByProject(projectId: string): Volume[] {
  const db = getDb();
  return db
    .prepare('SELECT * FROM volumes WHERE project_id = ? ORDER BY sort_order ASC, created_at ASC')
    .all(projectId) as Volume[];
}

export function findById(id: string): Volume | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM volumes WHERE id = ?').get(id) as Volume | undefined;
}

const VOLUME_UPDATE_FIELDS = new Set(['title', 'summary', 'sort_order']);

export function create(data: { projectId: string; title: string; summary?: string }): Volume {
  const db = getDb();
  const id = uuid();
  const now = new Date().toISOString();

  const maxOrder = db
    .prepare(
      'SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM volumes WHERE project_id = ?',
    )
    .get(data.projectId) as { next: number };

  db.prepare(`
    INSERT INTO volumes (id, project_id, title, summary, sort_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, data.projectId, data.title, data.summary ?? null, maxOrder.next, now, now);

  const created = findById(id);
  if (!created) throw new Error(`Failed to retrieve created volume: ${id}`);
  return created;
}

export function update(
  id: string,
  data: Partial<{
    title: string;
    summary: string;
    sort_order: number;
  }>,
): Volume | undefined {
  const db = getDb();
  const existing = findById(id);
  if (!existing) return undefined;

  const fields: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined && VOLUME_UPDATE_FIELDS.has(key)) {
      fields.push(`${key} = ?`);
      values.push(value);
    }
  }

  if (fields.length === 0) return existing;

  fields.push("updated_at = datetime('now')");
  values.push(id);

  db.prepare(`UPDATE volumes SET ${fields.join(', ')} WHERE id = ?`).run(...values);

  return findById(id);
}

export function deleteById(id: string): boolean {
  const db = getDb();
  const existing = findById(id);
  if (!existing) return false;

  db.prepare('DELETE FROM volumes WHERE id = ?').run(id);
  return true;
}

export function reorder(items: { id: string; sortOrder: number }[]): void {
  const db = getDb();
  const stmt = db.prepare(
    "UPDATE volumes SET sort_order = ?, updated_at = datetime('now') WHERE id = ?",
  );

  const transaction = db.transaction(() => {
    for (const item of items) {
      stmt.run(item.sortOrder, item.id);
    }
  });

  transaction();
}
