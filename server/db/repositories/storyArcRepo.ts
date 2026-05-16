import { v4 as uuid } from 'uuid';
import { getDb } from '../database.js';
import type { StoryArc } from '../../types/index.js';

export function findByProject(projectId: string): StoryArc[] {
  const db = getDb();
  return db
    .prepare('SELECT * FROM story_arcs WHERE project_id = ? ORDER BY sort_order ASC')
    .all(projectId) as StoryArc[];
}

export function findById(id: string): StoryArc | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM story_arcs WHERE id = ?').get(id) as StoryArc | undefined;
}

export function create(data: {
  projectId: string;
  name: string;
  description?: string;
  startChapter?: number;
  endChapter?: number;
  status?: string;
}): StoryArc {
  const db = getDb();
  const id = uuid();
  const now = new Date().toISOString();

  const maxOrder = db
    .prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM story_arcs WHERE project_id = ?')
    .get(data.projectId) as { next: number };

  db.prepare(`
    INSERT INTO story_arcs (id, project_id, name, description, start_chapter, end_chapter, status, sort_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, data.projectId, data.name,
    data.description ?? null,
    data.startChapter ?? null,
    data.endChapter ?? null,
    data.status ?? 'planned',
    maxOrder.next,
    now, now,
  );

  const created = findById(id);
  if (!created) throw new Error(`Failed to retrieve created story arc: ${id}`);
  return created;
}

const ARC_UPDATE_FIELDS = new Set(['name', 'description', 'start_chapter', 'end_chapter', 'status', 'sort_order']);

export function update(id: string, data: Partial<{
  name: string;
  description: string;
  start_chapter: number | null;
  end_chapter: number | null;
  status: string;
  sort_order: number;
}>): StoryArc | undefined {
  const db = getDb();
  const existing = findById(id);
  if (!existing) return undefined;

  const fields: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined && ARC_UPDATE_FIELDS.has(key)) {
      fields.push(`${key} = ?`);
      values.push(value);
    }
  }

  if (fields.length === 0) return existing;

  fields.push("updated_at = datetime('now')");
  values.push(id);

  db.prepare(`UPDATE story_arcs SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return findById(id);
}

export function deleteById(id: string): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM story_arcs WHERE id = ?').run(id);
  return result.changes > 0;
}