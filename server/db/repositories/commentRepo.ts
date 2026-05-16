import { v4 as uuid } from 'uuid';
import { getDb } from '../database.js';

export interface CommentRow {
  id: string;
  chapter_id: string;
  project_id: string;
  user_id: string;
  content: string;
  selection_from: number | null;
  selection_to: number | null;
  selection_text: string | null;
  resolved: number;
  created_at: string;
  updated_at: string;
}

export function findByChapter(chapterId: string): CommentRow[] {
  const db = getDb();
  return db.prepare('SELECT * FROM chapter_comments WHERE chapter_id = ? ORDER BY created_at ASC').all(chapterId) as CommentRow[];
}

export function findById(id: string): CommentRow | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM chapter_comments WHERE id = ?').get(id) as CommentRow | undefined;
}

export function create(data: {
  chapterId: string;
  projectId: string;
  userId: string;
  content: string;
  selectionFrom?: number;
  selectionTo?: number;
  selectionText?: string;
}): CommentRow {
  const db = getDb();
  const id = uuid();
  db.prepare(`
    INSERT INTO chapter_comments (id, chapter_id, project_id, user_id, content, selection_from, selection_to, selection_text)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, data.chapterId, data.projectId, data.userId, data.content,
    data.selectionFrom ?? null, data.selectionTo ?? null, data.selectionText ?? null,
  );
  return findById(id)!;
}

export function updateContent(id: string, content: string): CommentRow | undefined {
  const db = getDb();
  db.prepare("UPDATE chapter_comments SET content = ?, updated_at = datetime('now') WHERE id = ?").run(content, id);
  return findById(id);
}

export function resolve(id: string): CommentRow | undefined {
  const db = getDb();
  db.prepare("UPDATE chapter_comments SET resolved = 1, updated_at = datetime('now') WHERE id = ?").run(id);
  return findById(id);
}

export function remove(id: string): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM chapter_comments WHERE id = ?').run(id);
  return result.changes > 0;
}
