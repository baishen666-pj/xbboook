import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';

let _db: Database.Database | null = null;

export function getTestDb(): Database.Database {
  if (!_db) {
    _db = new Database(':memory:');
    _db.pragma('foreign_keys = ON');
    runMigrationsOn(_db);
  }
  return _db;
}

export function resetTestDb(): void {
  if (_db) _db.close();
  _db = null;
}

function runMigrationsOn(db: Database.Database): void {
  db.exec(`
    CREATE TABLE projects (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT, genre TEXT,
      writing_style TEXT, writing_mode TEXT DEFAULT 'webnovel', target_words INTEGER,
      status TEXT DEFAULT 'active', sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE volumes (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, title TEXT NOT NULL, summary TEXT,
      sort_order INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
    CREATE TABLE chapters (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, volume_id TEXT, title TEXT NOT NULL,
      summary TEXT, word_count INTEGER DEFAULT 0, file_path TEXT NOT NULL,
      status TEXT DEFAULT 'draft', sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (volume_id) REFERENCES volumes(id) ON DELETE SET NULL
    );
    CREATE TABLE characters (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, name TEXT NOT NULL, nickname TEXT,
      role_type TEXT DEFAULT 'supporting', gender TEXT, age TEXT, appearance TEXT,
      personality TEXT, background TEXT, abilities TEXT, notes TEXT,
      sort_order INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
    CREATE TABLE character_relations (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, character_a_id TEXT NOT NULL,
      character_b_id TEXT NOT NULL, relation_type TEXT NOT NULL, description TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (character_a_id) REFERENCES characters(id) ON DELETE CASCADE,
      FOREIGN KEY (character_b_id) REFERENCES characters(id) ON DELETE CASCADE
    );
    CREATE TABLE worldviews (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, category TEXT NOT NULL,
      title TEXT NOT NULL, content TEXT, sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
    CREATE TABLE outlines (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, level INTEGER DEFAULT 0,
      parent_id TEXT, target_ref_id TEXT, title TEXT NOT NULL, content TEXT,
      sort_order INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (parent_id) REFERENCES outlines(id) ON DELETE CASCADE
    );
    CREATE TABLE daily_stats (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, date TEXT NOT NULL,
      words_added INTEGER DEFAULT 0, words_total INTEGER DEFAULT 0,
      writing_time_ms INTEGER DEFAULT 0, chapters_worked INTEGER DEFAULT 0,
      UNIQUE(project_id, date),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
    CREATE TABLE writing_sessions (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, chapter_id TEXT NOT NULL,
      started_at TEXT NOT NULL, ended_at TEXT,
      words_start INTEGER DEFAULT 0, words_end INTEGER DEFAULT 0, duration_ms INTEGER DEFAULT 0,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
    );
    CREATE TABLE users (
      id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL, avatar_color TEXT NOT NULL DEFAULT '#6366f1',
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE project_members (
      project_id TEXT NOT NULL, user_id TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'writer', joined_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (project_id, user_id),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE chapter_locks (
      chapter_id TEXT PRIMARY KEY, user_id TEXT NOT NULL,
      locked_at TEXT DEFAULT (datetime('now')), expires_at TEXT,
      FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);
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
