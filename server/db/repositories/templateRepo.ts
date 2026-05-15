import { v4 as uuid } from 'uuid';
import { getDb } from '../database.js';
import type { OutlineTemplate } from '../../types/index.js';
import { BUILTIN_TEMPLATES } from '../seedTemplates.js';

export function findAll(): OutlineTemplate[] {
  const db = getDb();
  return db.prepare('SELECT * FROM outline_templates ORDER BY is_builtin DESC, genre, name').all() as OutlineTemplate[];
}

export function findByGenre(genre: string): OutlineTemplate[] {
  const db = getDb();
  return db.prepare('SELECT * FROM outline_templates WHERE genre = ? ORDER BY name').all(genre) as OutlineTemplate[];
}

export function findById(id: string): OutlineTemplate | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM outline_templates WHERE id = ?').get(id) as OutlineTemplate | undefined;
}

export function create(data: {
  name: string;
  genre: string;
  description?: string;
  isBuiltin?: number;
  sourceProjectId?: string;
  structure: string;
}): OutlineTemplate {
  const db = getDb();
  const id = uuid();
  db.prepare(
    `INSERT INTO outline_templates (id, name, genre, description, is_builtin, source_project_id, structure)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, data.name, data.genre, data.description ?? null, data.isBuiltin ?? 0, data.sourceProjectId ?? null, data.structure);
  return findById(id)!;
}

const TEMPLATE_UPDATE_FIELDS = new Set(['name', 'genre', 'description', 'structure', 'updated_at']);

export function update(id: string, data: Record<string, unknown>): OutlineTemplate | undefined {
  const db = getDb();
  const sets: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(data)) {
    if (TEMPLATE_UPDATE_FIELDS.has(key)) {
      sets.push(`${key} = ?`);
      values.push(value);
    }
  }

  if (sets.length === 0) return findById(id);

  sets.push("updated_at = datetime('now')");
  values.push(id);

  db.prepare(`UPDATE outline_templates SET ${sets.join(', ')} WHERE id = ?`).run(...values);
  return findById(id);
}

export function deleteById(id: string): boolean {
  const db = getDb();
  const template = findById(id);
  if (!template || template.is_builtin) return false;
  return db.prepare('DELETE FROM outline_templates WHERE id = ?').run(id).changes > 0;
}

export function seedBuiltins(): void {
  const db = getDb();
  const count = (db.prepare('SELECT COUNT(*) as c FROM outline_templates WHERE is_builtin = 1').get() as { c: number }).c;
  if (count > 0) return;

  for (const tpl of BUILTIN_TEMPLATES) {
    create({
      name: tpl.name,
      genre: tpl.genre,
      description: tpl.description,
      isBuiltin: 1,
      structure: JSON.stringify(tpl.structure),
    });
  }
}
