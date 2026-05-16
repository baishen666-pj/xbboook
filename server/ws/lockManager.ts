import { getDb } from '../db/database.js';

export function acquireLock(chapterId: string, userId: string, ttlMinutes = 30): boolean {
  const db = getDb();

  const result = db.transaction(() => {
    clearExpiredLocks();

    const existing = db.prepare('SELECT user_id FROM chapter_locks WHERE chapter_id = ?').get(chapterId) as
      | { user_id: string }
      | undefined;

    if (existing && existing.user_id !== userId) {
      return false;
    }

    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString();

    db.prepare(`
      INSERT INTO chapter_locks (chapter_id, user_id, locked_at, expires_at)
      VALUES (?, ?, datetime('now'), ?)
      ON CONFLICT(chapter_id) DO UPDATE SET user_id = excluded.user_id, locked_at = datetime('now'), expires_at = excluded.expires_at
    `).run(chapterId, userId, expiresAt);

    return true;
  })();

  return result;
}

export function releaseLock(chapterId: string, userId: string): boolean {
  const db = getDb();
  const result = db.prepare(
    'DELETE FROM chapter_locks WHERE chapter_id = ? AND user_id = ?'
  ).run(chapterId, userId);
  return result.changes > 0;
}

export function getLock(chapterId: string): { chapterId: string; userId: string; lockedAt: string; expiresAt: string | null } | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM chapter_locks WHERE chapter_id = ?').get(chapterId) as
    | { chapter_id: string; user_id: string; locked_at: string; expires_at: string | null }
    | undefined;

  if (!row) return null;

  if (row.expires_at && new Date(row.expires_at) < new Date()) {
    db.prepare('DELETE FROM chapter_locks WHERE chapter_id = ?').run(chapterId);
    return null;
  }

  return { chapterId: row.chapter_id, userId: row.user_id, lockedAt: row.locked_at, expiresAt: row.expires_at };
}

export function getProjectLocks(projectId: string): { chapterId: string; userId: string; lockedAt: string }[] {
  const db = getDb();
  clearExpiredLocks();
  const rows = db.prepare(`
    SELECT cl.chapter_id, cl.user_id, cl.locked_at
    FROM chapter_locks cl
    JOIN chapters c ON c.id = cl.chapter_id
    WHERE c.project_id = ?
  `).all(projectId) as { chapter_id: string; user_id: string; locked_at: string }[];
  return rows.map((r) => ({ chapterId: r.chapter_id, userId: r.user_id, lockedAt: r.locked_at }));
}

function clearExpiredLocks(): void {
  const db = getDb();
  db.prepare("DELETE FROM chapter_locks WHERE expires_at IS NOT NULL AND expires_at < datetime('now')").run();
}
