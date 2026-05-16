import { v4 as uuid } from 'uuid';
import { getDb } from '../database.js';
import type { Foreshadowing } from '../../types/index.js';

export function findAll(projectId: string): Foreshadowing[] {
  const db = getDb();
  return db
    .prepare('SELECT * FROM foreshadowing WHERE project_id = ? ORDER BY created_at ASC')
    .all(projectId) as Foreshadowing[];
}

export function findById(id: string): Foreshadowing | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM foreshadowing WHERE id = ?').get(id) as Foreshadowing | undefined;
}

export function findByChapter(chapterId: string): Foreshadowing[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT * FROM foreshadowing
       WHERE plant_chapter_id = ? OR expected_harvest_chapter_id = ? OR actual_harvest_chapter_id = ?
       ORDER BY created_at ASC`,
    )
    .all(chapterId, chapterId, chapterId) as Foreshadowing[];
}

export function findByStatus(projectId: string, status: string): Foreshadowing[] {
  const db = getDb();
  return db
    .prepare('SELECT * FROM foreshadowing WHERE project_id = ? AND status = ? ORDER BY created_at ASC')
    .all(projectId, status) as Foreshadowing[];
}

const FORESHADOWING_UPDATE_FIELDS = new Set([
  'title',
  'description',
  'plant_chapter_id',
  'expected_harvest_chapter_id',
  'actual_harvest_chapter_id',
  'status',
  'importance',
]);

export function create(data: {
  projectId: string;
  title: string;
  description?: string;
  plantChapterId?: string;
  expectedHarvestChapterId?: string;
  importance?: string;
}): Foreshadowing {
  const db = getDb();
  const id = uuid();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO foreshadowing (id, project_id, title, description, plant_chapter_id, expected_harvest_chapter_id, actual_harvest_chapter_id, status, importance, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'planted', ?, ?, ?)
  `).run(
    id,
    data.projectId,
    data.title,
    data.description ?? null,
    data.plantChapterId ?? null,
    data.expectedHarvestChapterId ?? null,
    null,
    data.importance ?? 'normal',
    now,
    now,
  );

  const created = findById(id);
  if (!created) throw new Error(`Failed to retrieve created foreshadowing: ${id}`);
  return created;
}

export function update(
  id: string,
  data: Partial<{
    title: string;
    description: string;
    plant_chapter_id: string;
    expected_harvest_chapter_id: string;
    actual_harvest_chapter_id: string;
    status: string;
    importance: string;
  }>,
): Foreshadowing | undefined {
  const db = getDb();
  const existing = findById(id);
  if (!existing) return undefined;

  const fields: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined && FORESHADOWING_UPDATE_FIELDS.has(key)) {
      fields.push(`${key} = ?`);
      values.push(value);
    }
  }

  if (fields.length === 0) return existing;

  fields.push("updated_at = datetime('now')");
  values.push(id);

  db.prepare(`UPDATE foreshadowing SET ${fields.join(', ')} WHERE id = ?`).run(...values);

  return findById(id);
}

export function updateStatus(id: string, status: string): Foreshadowing | undefined {
  return update(id, { status });
}

export function deleteById(id: string): boolean {
  const db = getDb();
  const existing = findById(id);
  if (!existing) return false;

  db.prepare('DELETE FROM foreshadowing WHERE id = ?').run(id);
  return true;
}
