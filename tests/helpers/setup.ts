import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import { SCHEMA_SQL, POST_SCHEMA_ALTER_SQL } from '../../server/db/schemaDefinitions.js';

let _db: Database.Database | null = null;

export function getTestDb(): Database.Database {
  if (!_db) {
    _db = new Database(':memory:');
    _db.pragma('foreign_keys = ON');
    _db.exec(SCHEMA_SQL);
    _db.exec(POST_SCHEMA_ALTER_SQL);
  }
  return _db;
}

export function resetTestDb(): void {
  if (_db) _db.close();
  _db = null;
}

export function seedProject(db: Database.Database, overrides?: { name?: string }): string {
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO projects (id, name, genre, writing_mode, sort_order, created_at, updated_at)
    VALUES (?, ?, 'fantasy', 'webnovel', 0, ?, ?)
  `).run(id, overrides?.name ?? 'Test Novel', now, now);
  return id;
}

export function seedChapter(db: Database.Database, projectId: string, title = 'Ch1'): string {
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO chapters (id, project_id, volume_id, title, word_count, file_path, status, sort_order, created_at, updated_at)
    VALUES (?, ?, NULL, ?, 0, ?, 'draft', 0, ?, ?)
  `).run(id, projectId, title, `${projectId}/chapters/${id}.md`, now, now);
  return id;
}

export function seedCharacter(db: Database.Database, projectId: string, name = 'Alice', roleType = 'protagonist'): string {
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO characters (id, project_id, name, role_type, sort_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, 0, ?, ?)
  `).run(id, projectId, name, roleType, now, now);
  return id;
}

export function seedUser(db: Database.Database, overrides?: { username?: string; displayName?: string; avatarColor?: string }): string {
  const id = randomUUID();
  db.prepare(`
    INSERT INTO users (id, username, display_name, avatar_color)
    VALUES (?, ?, ?, ?)
  `).run(id, overrides?.username ?? 'testuser', overrides?.displayName ?? 'Test User', overrides?.avatarColor ?? '#6366f1');
  return id;
}

export function seedDailyStat(db: Database.Database, projectId: string, date: string, wordsAdded: number, wordsTotal = 0): string {
  const id = randomUUID();
  db.prepare(`
    INSERT INTO daily_stats (id, project_id, date, words_added, words_total, writing_time_ms, chapters_worked)
    VALUES (?, ?, ?, ?, ?, 0, 1)
  `).run(id, projectId, date, wordsAdded, wordsTotal);
  return id;
}

export function seedWritingSession(db: Database.Database, projectId: string, chapterId: string, overrides?: { startedAt?: string; endedAt?: string; wordsStart?: number; wordsEnd?: number }): string {
  const id = randomUUID();
  const startedAt = overrides?.startedAt ?? new Date().toISOString();
  db.prepare(`
    INSERT INTO writing_sessions (id, project_id, chapter_id, started_at, ended_at, words_start, words_end, duration_ms)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, projectId, chapterId, startedAt, overrides?.endedAt ?? null,
    overrides?.wordsStart ?? 0, overrides?.wordsEnd ?? 0, 0,
  );
  return id;
}

export function seedMember(db: Database.Database, projectId: string, userId: string, role = 'writer'): void {
  db.prepare(`
    INSERT INTO project_members (project_id, user_id, role)
    VALUES (?, ?, ?)
  `).run(projectId, userId, role);
}
