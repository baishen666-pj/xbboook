import { v4 as uuid } from 'uuid';
import { getDb } from '../database.js';
import { writeChapter, deleteChapter } from '../../services/fileService.js';
import type { Chapter } from '../../types/index.js';

export function findByProject(projectId: string): Chapter[] {
  const db = getDb();
  return db
    .prepare(
      'SELECT * FROM chapters WHERE project_id = ? ORDER BY sort_order ASC, created_at ASC',
    )
    .all(projectId) as Chapter[];
}

export function findById(id: string): Chapter | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM chapters WHERE id = ?').get(id) as Chapter | undefined;
}

export function create(data: {
  projectId: string;
  title: string;
  volumeId?: string;
  summary?: string;
}): Chapter {
  const db = getDb();
  const id = uuid();
  const now = new Date().toISOString();
  const filePath = `${data.projectId}/chapters/${id}.md`;

  const maxOrder = db
    .prepare(
      'SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM chapters WHERE project_id = ?',
    )
    .get(data.projectId) as { next: number };

  db.prepare(`
    INSERT INTO chapters (id, project_id, volume_id, title, summary, word_count, file_path, status, sort_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 0, ?, 'draft', ?, ?, ?)
  `).run(
    id,
    data.projectId,
    data.volumeId ?? null,
    data.title,
    data.summary ?? null,
    filePath,
    maxOrder.next,
    now,
    now,
  );

  writeChapter(data.projectId, id, '');

  return findById(id)!;
}

export function update(
  id: string,
  data: Partial<{
    title: string;
    volume_id: string | null;
    summary: string;
    status: string;
    sort_order: number;
  }>,
): Chapter | undefined {
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

  db.prepare(`UPDATE chapters SET ${fields.join(', ')} WHERE id = ?`).run(...values);

  return findById(id);
}

export function updateContent(id: string, content: string): Chapter | undefined {
  const db = getDb();
  const existing = findById(id);
  if (!existing) return undefined;

  const wordCount = content.length;

  writeChapter(existing.project_id, id, content);

  db.prepare(
    "UPDATE chapters SET word_count = ?, updated_at = datetime('now') WHERE id = ?",
  ).run(wordCount, id);

  return findById(id);
}

export function deleteById(id: string): boolean {
  const db = getDb();
  const existing = findById(id);
  if (!existing) return false;

  deleteChapter(existing.project_id, id);
  db.prepare('DELETE FROM chapters WHERE id = ?').run(id);
  return true;
}

export function reorder(items: { id: string; volumeId?: string | null; sortOrder: number }[]): void {
  const db = getDb();
  const stmt = db.prepare(
    "UPDATE chapters SET volume_id = ?, sort_order = ?, updated_at = datetime('now') WHERE id = ?",
  );

  const transaction = db.transaction(() => {
    for (const item of items) {
      stmt.run(item.volumeId ?? null, item.sortOrder, item.id);
    }
  });

  transaction();
}
