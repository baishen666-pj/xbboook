import { v4 as uuid } from 'uuid';
import { getDb } from '../database.js';

export interface ChatMessageRow {
  id: string;
  project_id: string;
  chapter_id: string | null;
  role: 'user' | 'assistant' | 'system';
  content: string;
  skill_id: string;
  token_usage: number | null;
  created_at: string;
}

export function findByProject(projectId: string, chapterId?: string): ChatMessageRow[] {
  const db = getDb();
  if (chapterId) {
    return db.prepare(
      'SELECT * FROM chat_messages WHERE project_id = ? AND chapter_id = ? ORDER BY created_at ASC',
    ).all(projectId, chapterId) as ChatMessageRow[];
  }
  return db.prepare(
    'SELECT * FROM chat_messages WHERE project_id = ? ORDER BY created_at ASC',
  ).all(projectId) as ChatMessageRow[];
}

export function findById(id: string): ChatMessageRow | undefined {
  return getDb().prepare('SELECT * FROM chat_messages WHERE id = ?').get(id) as ChatMessageRow | undefined;
}

export function create(data: {
  projectId: string;
  chapterId?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  skillId?: string;
  tokenUsage?: number;
}): ChatMessageRow {
  const db = getDb();
  const id = uuid();
  db.prepare(`
    INSERT INTO chat_messages (id, project_id, chapter_id, role, content, skill_id, token_usage)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, data.projectId, data.chapterId ?? null, data.role, data.content, data.skillId ?? '', data.tokenUsage ?? null);
  return findById(id)!;
}

export function deleteByProject(projectId: string): number {
  const result = getDb().prepare('DELETE FROM chat_messages WHERE project_id = ?').run(projectId);
  return result.changes;
}

export function deleteByChapter(projectId: string, chapterId: string): number {
  const result = getDb().prepare('DELETE FROM chat_messages WHERE project_id = ? AND chapter_id = ?').run(projectId, chapterId);
  return result.changes;
}
