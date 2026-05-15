import { v4 as uuid } from 'uuid';
import { getDb } from '../database.js';
import type { ChapterVersion } from '../../types/index.js';

export function findByChapter(
  chapterId: string,
  opts?: { limit?: number; offset?: number },
): ChapterVersion[] {
  const db = getDb();
  const limit = opts?.limit ?? 50;
  const offset = opts?.offset ?? 0;
  return db
    .prepare(
      `SELECT * FROM chapter_versions
       WHERE chapter_id = ?
       ORDER BY version_number DESC
       LIMIT ? OFFSET ?`,
    )
    .all(chapterId, limit, offset) as ChapterVersion[];
}

export function findById(id: string): ChapterVersion | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM chapter_versions WHERE id = ?').get(id) as ChapterVersion | undefined;
}

export function findLatestVersionNumber(chapterId: string): number {
  const db = getDb();
  const row = db
    .prepare('SELECT MAX(version_number) as max_ver FROM chapter_versions WHERE chapter_id = ?')
    .get(chapterId) as { max_ver: number | null };
  return row.max_ver ?? 0;
}

export function create(data: {
  chapterId: string;
  projectId: string;
  contentHash: string;
  wordCount: number;
  snapshotType: string;
  label?: string;
}): ChapterVersion {
  const db = getDb();
  const id = uuid();
  const versionNumber = findLatestVersionNumber(data.chapterId) + 1;

  db.prepare(
    `INSERT INTO chapter_versions (id, chapter_id, project_id, version_number, content_hash, word_count, snapshot_type, label)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    data.chapterId,
    data.projectId,
    versionNumber,
    data.contentHash,
    data.wordCount,
    data.snapshotType,
    data.label ?? null,
  );

  return findById(id)!;
}

export function deleteByChapter(chapterId: string): number {
  const db = getDb();
  return db.prepare('DELETE FROM chapter_versions WHERE chapter_id = ?').run(chapterId).changes;
}

export function deleteOldVersions(chapterId: string, keepCount: number): number {
  const db = getDb();
  const versions = db
    .prepare('SELECT id FROM chapter_versions WHERE chapter_id = ? ORDER BY version_number DESC')
    .all(chapterId) as { id: string }[];

  if (versions.length <= keepCount) return 0;

  const toDelete = versions.slice(keepCount).map((v) => v.id);
  const stmt = db.prepare('DELETE FROM chapter_versions WHERE id = ?');
  let deleted = 0;
  for (const id of toDelete) {
    deleted += stmt.run(id).changes;
  }
  return deleted;
}
