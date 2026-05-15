import { v4 as uuid } from 'uuid';
import { getDb } from '../database.js';
import type { Outline } from '../../types/index.js';

export function findByProject(projectId: string): Outline[] {
  const db = getDb();
  return db
    .prepare('SELECT * FROM outlines WHERE project_id = ? ORDER BY level ASC, sort_order ASC')
    .all(projectId) as Outline[];
}

export function findByLevel(projectId: string, level: number): Outline[] {
  const db = getDb();
  return db
    .prepare('SELECT * FROM outlines WHERE project_id = ? AND level = ? ORDER BY sort_order ASC')
    .all(projectId, level) as Outline[];
}

export function findChildren(projectId: string, parentId: string): Outline[] {
  const db = getDb();
  return db
    .prepare('SELECT * FROM outlines WHERE project_id = ? AND parent_id = ? ORDER BY sort_order ASC')
    .all(projectId, parentId) as Outline[];
}

export function findById(id: string): Outline | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM outlines WHERE id = ?').get(id) as Outline | undefined;
}

export function create(data: {
  projectId: string;
  level?: number;
  parentId?: string;
  targetRefId?: string;
  title: string;
  content?: string;
}): Outline {
  const db = getDb();
  const id = uuid();
  const now = new Date().toISOString();

  const maxOrder = db
    .prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM outlines WHERE project_id = ?')
    .get(data.projectId) as { next: number };

  db.prepare(`
    INSERT INTO outlines (id, project_id, level, parent_id, target_ref_id, title, content, sort_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    data.projectId,
    data.level ?? 0,
    data.parentId ?? null,
    data.targetRefId ?? null,
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
    level: number;
    parent_id: string | null;
    target_ref_id: string | null;
    title: string;
    content: string;
    sort_order: number;
  }>,
): Outline | undefined {
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

  db.prepare(`UPDATE outlines SET ${fields.join(', ')} WHERE id = ?`).run(...values);

  return findById(id);
}

export function deleteById(id: string): boolean {
  const db = getDb();
  const existing = findById(id);
  if (!existing) return false;

  // Reassign children to parent
  db.prepare('UPDATE outlines SET parent_id = ? WHERE parent_id = ?').run(existing.parent_id, id);
  db.prepare('DELETE FROM outlines WHERE id = ?').run(id);
  return true;
}
