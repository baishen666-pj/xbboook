import { getDb } from '../database.js';
import { randomUUID } from 'crypto';
import { logger } from '../../services/logger.js';

export interface ChapterVersionSnapshot {
  id: string;
  chapter_id: string;
  project_id: string;
  title: string;
  content: string;
  word_count: number;
  snapshot_type: 'manual' | 'auto' | 'milestone';
  note: string | null;
  created_at: string;
}

export function create(data: Omit<ChapterVersionSnapshot, 'id' | 'created_at'>): ChapterVersionSnapshot {
  const db = getDb();
  const snapshot: ChapterVersionSnapshot = {
    id: randomUUID(),
    ...data,
    created_at: new Date().toISOString(),
  };
  db.prepare(`INSERT INTO chapter_version_snapshots (id, chapter_id, project_id, title, content, word_count, snapshot_type, note, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    snapshot.id, snapshot.chapter_id, snapshot.project_id, snapshot.title,
    snapshot.content, snapshot.word_count, snapshot.snapshot_type, snapshot.note, snapshot.created_at,
  );
  return snapshot;
}

export function findByChapter(chapterId: string): ChapterVersionSnapshot[] {
  const db = getDb();
  return db.prepare('SELECT * FROM chapter_version_snapshots WHERE chapter_id = ? ORDER BY created_at DESC').all(chapterId) as ChapterVersionSnapshot[];
}

export function findByProject(projectId: string): ChapterVersionSnapshot[] {
  const db = getDb();
  return db.prepare('SELECT * FROM chapter_version_snapshots WHERE project_id = ? ORDER BY created_at DESC').all(projectId) as ChapterVersionSnapshot[];
}

export function findById(id: string): ChapterVersionSnapshot | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM chapter_version_snapshots WHERE id = ?').get(id) as ChapterVersionSnapshot | undefined;
}

export function remove(id: string): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM chapter_version_snapshots WHERE id = ?').run(id);
  return result.changes > 0;
}

export function removeByChapter(chapterId: string): number {
  const db = getDb();
  const result = db.prepare('DELETE FROM chapter_version_snapshots WHERE chapter_id = ?').run(chapterId);
  return result.changes;
}

export function getDiff(id1: string, id2: string): { snapshot1: ChapterVersionSnapshot; snapshot2: ChapterVersionSnapshot; added_lines: number; removed_lines: number } | null {
  const db = getDb();
  const s1 = db.prepare('SELECT * FROM chapter_version_snapshots WHERE id = ?').get(id1) as ChapterVersionSnapshot | undefined;
  const s2 = db.prepare('SELECT * FROM chapter_version_snapshots WHERE id = ?').get(id2) as ChapterVersionSnapshot | undefined;
  if (!s1 || !s2) return null;

  const lines1 = s1.content.split('\n');
  const lines2 = s2.content.split('\n');
  const linesSet1 = new Set(lines1);
  const linesSet2 = new Set(lines2);

  let added = 0;
  let removed = 0;
  for (const line of lines2) { if (!linesSet1.has(line)) added++; }
  for (const line of lines1) { if (!linesSet2.has(line)) removed++; }

  return { snapshot1: s1, snapshot2: s2, added_lines: added, removed_lines: removed };
}
