import { getDb } from '../database.js';
import type { SnippetTemplate } from '../../types/index.js';

export function findAll(projectId: string): SnippetTemplate[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT * FROM snippet_templates
       WHERE project_id = ? OR (project_id IS NULL AND is_builtin = 1)
       ORDER BY category ASC, sort_order ASC, id ASC`,
    )
    .all(projectId) as SnippetTemplate[];
}

export function findById(id: number): SnippetTemplate | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM snippet_templates WHERE id = ?').get(id) as SnippetTemplate | undefined;
}

export function findByCategory(projectId: string, category: string): SnippetTemplate[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT * FROM snippet_templates
       WHERE (project_id = ? OR (project_id IS NULL AND is_builtin = 1)) AND category = ?
       ORDER BY sort_order ASC, id ASC`,
    )
    .all(projectId, category) as SnippetTemplate[];
}

export function findBuiltin(): SnippetTemplate[] {
  const db = getDb();
  return db
    .prepare('SELECT * FROM snippet_templates WHERE is_builtin = 1 ORDER BY category ASC, sort_order ASC, id ASC')
    .all() as SnippetTemplate[];
}

const SNIPPET_UPDATE_FIELDS = new Set([
  'name',
  'category',
  'content',
  'sort_order',
]);

export function create(data: {
  projectId: string | null;
  name: string;
  category?: string;
  content: string;
  isBuiltin?: number;
  sortOrder?: number;
}): SnippetTemplate {
  const db = getDb();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO snippet_templates (project_id, name, category, content, is_builtin, sort_order, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.projectId ?? null,
    data.name,
    data.category ?? 'custom',
    data.content,
    data.isBuiltin ?? 0,
    data.sortOrder ?? 0,
    now,
  );

  const id = db.prepare('SELECT last_insert_rowid() as id').get() as { id: number };
  const created = findById(id.id);
  if (!created) throw new Error(`Failed to retrieve created snippet: ${id.id}`);
  return created;
}

export function update(
  id: number,
  data: Partial<{
    name: string;
    category: string;
    content: string;
    sort_order: number;
  }>,
): SnippetTemplate | undefined {
  const db = getDb();
  const existing = findById(id);
  if (!existing) return undefined;

  const fields: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined && SNIPPET_UPDATE_FIELDS.has(key)) {
      fields.push(`${key} = ?`);
      values.push(value);
    }
  }

  if (fields.length === 0) return existing;

  values.push(id);

  db.prepare(`UPDATE snippet_templates SET ${fields.join(', ')} WHERE id = ?`).run(...values);

  return findById(id);
}

export function deleteById(id: number): boolean {
  const db = getDb();
  const existing = findById(id);
  if (!existing) return false;
  if (existing.is_builtin) return false;

  db.prepare('DELETE FROM snippet_templates WHERE id = ?').run(id);
  return true;
}

export function countBuiltin(): number {
  const db = getDb();
  const row = db.prepare('SELECT COUNT(*) as count FROM snippet_templates WHERE is_builtin = 1').get() as { count: number };
  return row.count;
}