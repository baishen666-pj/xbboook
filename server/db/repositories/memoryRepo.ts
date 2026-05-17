import { v4 as uuid } from 'uuid';
import { getDb } from '../database.js';

export interface AiMemory {
  id: string;
  project_id: string;
  chapter_id: string | null;
  category: string;
  title: string;
  content: string;
  importance: string;
  chapter_index: number | null;
  is_auto_extracted: number;
  created_at: string;
  updated_at: string;
}

const UPDATE_FIELDS = new Set([
  'chapter_id', 'category', 'title', 'content',
  'importance', 'chapter_index',
]);

export function findByProject(projectId: string, filters?: { category?: string; importance?: string }): AiMemory[] {
  const db = getDb();
  if (filters?.category) {
    return db.prepare(
      'SELECT * FROM ai_memory_entries WHERE project_id = ? AND category = ? ORDER BY chapter_index ASC, created_at ASC',
    ).all(projectId, filters.category) as AiMemory[];
  }
  if (filters?.importance) {
    return db.prepare(
      'SELECT * FROM ai_memory_entries WHERE project_id = ? AND importance = ? ORDER BY chapter_index ASC, created_at ASC',
    ).all(projectId, filters.importance) as AiMemory[];
  }
  return db.prepare(
    'SELECT * FROM ai_memory_entries WHERE project_id = ? ORDER BY chapter_index ASC, created_at ASC',
  ).all(projectId) as AiMemory[];
}

export function findById(id: string): AiMemory | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM ai_memory_entries WHERE id = ?').get(id) as AiMemory | undefined;
}

export function findByChapter(chapterId: string): AiMemory[] {
  const db = getDb();
  return db.prepare(
    'SELECT * FROM ai_memory_entries WHERE chapter_id = ? ORDER BY created_at ASC',
  ).all(chapterId) as AiMemory[];
}

export function findRelevant(projectId: string, limit = 20): AiMemory[] {
  const db = getDb();
  return db.prepare(
    `SELECT * FROM ai_memory_entries
     WHERE project_id = ? AND importance IN ('critical', 'high')
     ORDER BY chapter_index DESC, updated_at DESC LIMIT ?`,
  ).all(projectId, limit) as AiMemory[];
}

export function create(data: {
  projectId: string;
  chapterId?: string;
  category: string;
  title: string;
  content: string;
  importance?: string;
  chapterIndex?: number;
  isAutoExtracted?: boolean;
}): AiMemory {
  const db = getDb();
  const id = uuid();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO ai_memory_entries (id, project_id, chapter_id, category, title, content, importance, chapter_index, is_auto_extracted, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    data.projectId,
    data.chapterId ?? null,
    data.category,
    data.title,
    data.content,
    data.importance ?? 'normal',
    data.chapterIndex ?? null,
    data.isAutoExtracted ? 1 : 0,
    now,
    now,
  );

  const created = findById(id);
  if (!created) throw new Error(`Failed to retrieve created memory: ${id}`);
  return created;
}

export function createBatch(entries: Array<{
  projectId: string;
  chapterId?: string;
  category: string;
  title: string;
  content: string;
  importance?: string;
  chapterIndex?: number;
  isAutoExtracted?: boolean;
}>): AiMemory[] {
  const db = getDb();
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT INTO ai_memory_entries (id, project_id, chapter_id, category, title, content, importance, chapter_index, is_auto_extracted, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const results: AiMemory[] = [];

  const tx = db.transaction(() => {
    for (const data of entries) {
      const id = uuid();
      stmt.run(
        id,
        data.projectId,
        data.chapterId ?? null,
        data.category,
        data.title,
        data.content,
        data.importance ?? 'normal',
        data.chapterIndex ?? null,
        data.isAutoExtracted ? 1 : 0,
        now,
        now,
      );
      const created = findById(id);
      if (created) results.push(created);
    }
  });
  tx();

  return results;
}

export function update(id: string, data: Partial<{
  chapter_id: string | null;
  category: string;
  title: string;
  content: string;
  importance: string;
  chapter_index: number | null;
}>): AiMemory | undefined {
  const db = getDb();
  const existing = findById(id);
  if (!existing) return undefined;

  const fields: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined && UPDATE_FIELDS.has(key)) {
      fields.push(`${key} = ?`);
      values.push(value);
    }
  }

  if (fields.length === 0) return existing;

  fields.push("updated_at = datetime('now')");
  values.push(id);
  db.prepare(`UPDATE ai_memory_entries SET ${fields.join(', ')} WHERE id = ?`).run(...values);

  return findById(id);
}

export function deleteById(id: string): boolean {
  const db = getDb();
  const existing = findById(id);
  if (!existing) return false;
  db.prepare('DELETE FROM ai_memory_entries WHERE id = ?').run(id);
  return true;
}

export function deleteByProject(projectId: string): number {
  const db = getDb();
  const result = db.prepare('DELETE FROM ai_memory_entries WHERE project_id = ?').run(projectId);
  return result.changes;
}

export function deleteAutoExtracted(projectId: string): number {
  const db = getDb();
  const result = db.prepare('DELETE FROM ai_memory_entries WHERE project_id = ? AND is_auto_extracted = 1').run(projectId);
  return result.changes;
}

export function countByProject(projectId: string): number {
  const db = getDb();
  const row = db.prepare('SELECT COUNT(*) as cnt FROM ai_memory_entries WHERE project_id = ?').get(projectId) as { cnt: number };
  return row.cnt;
}
