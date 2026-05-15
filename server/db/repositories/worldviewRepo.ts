import { v4 as uuid } from 'uuid';
import { getDb } from '../database.js';
import type { Worldview } from '../../types/index.js';

export function findByProject(projectId: string): Worldview[] {
  const db = getDb();
  return db
    .prepare('SELECT * FROM worldviews WHERE project_id = ? ORDER BY category ASC, sort_order ASC')
    .all(projectId) as Worldview[];
}

export function findByCategory(projectId: string, category: string): Worldview[] {
  const db = getDb();
  return db
    .prepare('SELECT * FROM worldviews WHERE project_id = ? AND category = ? ORDER BY sort_order ASC')
    .all(projectId, category) as Worldview[];
}

export function findById(id: string): Worldview | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM worldviews WHERE id = ?').get(id) as Worldview | undefined;
}

export function getCategories(projectId: string): string[] {
  const db = getDb();
  const rows = db
    .prepare('SELECT DISTINCT category FROM worldviews WHERE project_id = ? ORDER BY category ASC')
    .all(projectId) as Array<{ category: string }>;
  return rows.map((r) => r.category);
}

export function create(data: {
  projectId: string;
  category: string;
  title: string;
  content?: string;
}): Worldview {
  const db = getDb();
  const id = uuid();
  const now = new Date().toISOString();

  const maxOrder = db
    .prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM worldviews WHERE project_id = ?')
    .get(data.projectId) as { next: number };

  db.prepare(`
    INSERT INTO worldviews (id, project_id, category, title, content, sort_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    data.projectId,
    data.category,
    data.title,
    data.content ?? null,
    maxOrder.next,
    now,
    now,
  );

  return findById(id)!;
}

export function update(
  id: string,
  data: Partial<{
    category: string;
    title: string;
    content: string;
    sort_order: number;
  }>,
): Worldview | undefined {
  const db = getDb();
  const existing = findById(id);
  if (!existing) return undefined;

  const fields: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      fields.push(`${key} = ?`);
      values.push(value);
    }
  }

  if (fields.length === 0) return existing;

  fields.push("updated_at = datetime('now')");
  values.push(id);

  db.prepare(`UPDATE worldviews SET ${fields.join(', ')} WHERE id = ?`).run(...values);

  return findById(id);
}

export function deleteById(id: string): boolean {
  const db = getDb();
  const existing = findById(id);
  if (!existing) return false;

  db.prepare('DELETE FROM worldviews WHERE id = ?').run(id);
  return true;
}
