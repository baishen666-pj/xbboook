import { v4 as uuid } from 'uuid';
import { getDb } from '../database.js';
import { ensureProjectDir, deleteProjectDir } from '../../services/fileService.js';
import type { Project } from '../../types/index.js';

export function findAll(): Project[] {
  const db = getDb();
  return db
    .prepare('SELECT * FROM projects ORDER BY sort_order ASC, created_at DESC')
    .all() as Project[];
}

export function findById(id: string): Project | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as Project | undefined;
}

export function create(data: {
  name: string;
  description?: string;
  genre?: string;
  writing_style?: string;
  writing_mode?: string;
  target_words?: number;
}): Project {
  const db = getDb();
  const id = uuid();
  const now = new Date().toISOString();

  const maxOrder = db
    .prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM projects')
    .get() as { next: number };

  db.prepare(`
    INSERT INTO projects (id, name, description, genre, writing_style, writing_mode, target_words, sort_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    data.name,
    data.description ?? null,
    data.genre ?? null,
    data.writing_style ?? null,
    data.writing_mode ?? 'webnovel',
    data.target_words ?? null,
    maxOrder.next,
    now,
    now,
  );

  ensureProjectDir(id);

  return findById(id)!;
}

export function update(
  id: string,
  data: Partial<{
    name: string;
    description: string;
    genre: string;
    writing_style: string;
    writing_mode: string;
    target_words: number;
    status: string;
    sort_order: number;
  }>,
): Project | undefined {
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

  db.prepare(`UPDATE projects SET ${fields.join(', ')} WHERE id = ?`).run(...values);

  return findById(id);
}

export function deleteById(id: string): boolean {
  const db = getDb();
  const existing = findById(id);
  if (!existing) return false;

  db.prepare('DELETE FROM projects WHERE id = ?').run(id);
  deleteProjectDir(id);
  return true;
}
