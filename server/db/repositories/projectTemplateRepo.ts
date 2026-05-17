import { v4 as uuid } from 'uuid';
import { getDb } from '../database.js';

export interface ProjectTemplate {
  id: string;
  name: string;
  genre: string | null;
  description: string | null;
  is_builtin: number;
  structure: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectTemplateStructure {
  project: {
    genre?: string;
    writingMode?: string;
    writingStyle?: string;
    targetWords?: number;
    dailyTarget?: number;
  };
  characters: Array<{
    name: string;
    roleType: string;
    gender?: string;
    personality?: string;
    background?: string;
  }>;
  worldview: Array<{
    category: string;
    title: string;
    content?: string;
  }>;
  outlines: Array<{
    title: string;
    content?: string;
    level: number;
  }>;
  chapters: Array<{
    title: string;
    content: string;
  }>;
}

export function findAll(): ProjectTemplate[] {
  const db = getDb();
  return db.prepare('SELECT * FROM project_templates ORDER BY is_builtin DESC, genre, name').all() as ProjectTemplate[];
}

export function findByGenre(genre: string): ProjectTemplate[] {
  const db = getDb();
  return db.prepare('SELECT * FROM project_templates WHERE genre = ? ORDER BY name').all(genre) as ProjectTemplate[];
}

export function findById(id: string): ProjectTemplate | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM project_templates WHERE id = ?').get(id) as ProjectTemplate | undefined;
}

export function create(data: {
  name: string;
  genre?: string;
  description?: string;
  isBuiltin?: number;
  structure: string;
}): ProjectTemplate {
  const db = getDb();
  const id = uuid();
  db.prepare(
    `INSERT INTO project_templates (id, name, genre, description, is_builtin, structure)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(id, data.name, data.genre ?? null, data.description ?? null, data.isBuiltin ?? 0, data.structure);
  return findById(id)!;
}

export function deleteById(id: string): boolean {
  const db = getDb();
  const template = findById(id);
  if (!template || template.is_builtin) return false;
  return db.prepare('DELETE FROM project_templates WHERE id = ?').run(id).changes > 0;
}

export function seedBuiltins(builtins: Array<{ name: string; genre: string; description: string; structure: string }>): void {
  const db = getDb();
  const count = (db.prepare('SELECT COUNT(*) as c FROM project_templates WHERE is_builtin = 1').get() as { c: number }).c;
  if (count > 0) return;

  for (const tpl of builtins) {
    create({
      name: tpl.name,
      genre: tpl.genre,
      description: tpl.description,
      isBuiltin: 1,
      structure: tpl.structure,
    });
  }
}
