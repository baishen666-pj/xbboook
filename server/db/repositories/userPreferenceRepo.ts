import { getDb } from '../database.js';

export interface UserPreferenceRow {
  user_id: string;
  key: string;
  value: string;
  updated_at: string;
}

export function get(userId: string, key: string): string | undefined {
  const row = getDb().prepare(
    'SELECT value FROM user_preferences WHERE user_id = ? AND key = ?',
  ).get(userId, key) as { value: string } | undefined;
  return row?.value;
}

export function getAll(userId: string): UserPreferenceRow[] {
  return getDb().prepare(
    'SELECT * FROM user_preferences WHERE user_id = ? ORDER BY key',
  ).all(userId) as UserPreferenceRow[];
}

export function set(userId: string, key: string, value: string): void {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO user_preferences (user_id, key, value, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `).run(userId, key, value, now);
}

export function setBatch(userId: string, entries: Record<string, string>): void {
  const db = getDb();
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT INTO user_preferences (user_id, key, value, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `);
  const tx = db.transaction(() => {
    for (const [key, value] of Object.entries(entries)) {
      stmt.run(userId, key, value, now);
    }
  });
  tx();
}

export function remove(userId: string, key: string): boolean {
  const result = getDb().prepare(
    'DELETE FROM user_preferences WHERE user_id = ? AND key = ?',
  ).run(userId, key);
  return result.changes > 0;
}
