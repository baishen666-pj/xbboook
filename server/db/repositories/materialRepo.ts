import { getDb } from '../database.js';
import { randomUUID } from 'crypto';

export interface Material {
  id: string;
  project_id: string;
  title: string;
  content: string;
  category: string;
  tags: string; // JSON array
  source: string | null;
  metadata: string; // JSON object
  created_at: string;
  updated_at: string;
}

export interface CreateMaterialInput {
  project_id: string;
  title: string;
  content: string;
  category?: string;
  tags?: string[];
  source?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateMaterialInput {
  title?: string;
  content?: string;
  category?: string;
  tags?: string[];
  source?: string;
  metadata?: Record<string, unknown>;
}

export function create(input: CreateMaterialInput): Material {
  const db = getDb();
  const id = randomUUID();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO material_box (id, project_id, title, content, category, tags, source, metadata, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    input.project_id,
    input.title,
    input.content,
    input.category || 'other',
    JSON.stringify(input.tags || []),
    input.source || null,
    JSON.stringify(input.metadata || {}),
    now,
    now,
  );

  return findById(id)!;
}

export function findById(id: string): Material | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM material_box WHERE id = ?').get(id) as Material | undefined;
}

export function findByProject(projectId: string, category?: string): Material[] {
  const db = getDb();
  if (category) {
    return db.prepare('SELECT * FROM material_box WHERE project_id = ? AND category = ? ORDER BY updated_at DESC').all(projectId, category) as Material[];
  }
  return db.prepare('SELECT * FROM material_box WHERE project_id = ? ORDER BY updated_at DESC').all(projectId) as Material[];
}

export function search(projectId: string, query: string): Material[] {
  const db = getDb();
  const like = `%${query}%`;
  return db.prepare(`
    SELECT * FROM material_box
    WHERE project_id = ? AND (title LIKE ? OR content LIKE ? OR tags LIKE ?)
    ORDER BY updated_at DESC
  `).all(projectId, like, like, like) as Material[];
}

export function update(id: string, input: UpdateMaterialInput): Material | undefined {
  const db = getDb();
  const existing = findById(id);
  if (!existing) return undefined;

  const now = new Date().toISOString();
  const updates: string[] = [];
  const values: unknown[] = [];

  if (input.title !== undefined) { updates.push('title = ?'); values.push(input.title); }
  if (input.content !== undefined) { updates.push('content = ?'); values.push(input.content); }
  if (input.category !== undefined) { updates.push('category = ?'); values.push(input.category); }
  if (input.tags !== undefined) { updates.push('tags = ?'); values.push(JSON.stringify(input.tags)); }
  if (input.source !== undefined) { updates.push('source = ?'); values.push(input.source); }
  if (input.metadata !== undefined) { updates.push('metadata = ?'); values.push(JSON.stringify(input.metadata)); }

  if (updates.length === 0) return existing;

  updates.push('updated_at = ?');
  values.push(now);
  values.push(id);

  db.prepare(`UPDATE material_box SET ${updates.join(', ')} WHERE id = ?`).run(...values);

  return findById(id);
}

export function remove(id: string): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM material_box WHERE id = ?').run(id);
  return result.changes > 0;
}

export function countByCategory(projectId: string): Array<{ category: string; count: number }> {
  const db = getDb();
  return db.prepare('SELECT category, COUNT(*) as count FROM material_box WHERE project_id = ? GROUP BY category').all(projectId) as Array<{ category: string; count: number }>;
}
