import { describe, it, expect, vi, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';

let memDb: Database.Database;

vi.mock('../../server/db/database.js', () => ({
  getDb: () => memDb,
}));

import * as lockManager from '../../server/ws/lockManager.js';

function setupTables(): void {
  memDb.exec(`
    CREATE TABLE projects (
      id TEXT PRIMARY KEY, name TEXT NOT NULL,
      status TEXT DEFAULT 'active', sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE users (
      id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL, avatar_color TEXT NOT NULL DEFAULT '#6366f1',
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE chapters (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, title TEXT NOT NULL,
      file_path TEXT NOT NULL, status TEXT DEFAULT 'draft', sort_order INTEGER DEFAULT 0,
      word_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
    CREATE TABLE chapter_locks (
      chapter_id TEXT PRIMARY KEY, user_id TEXT NOT NULL,
      locked_at TEXT DEFAULT (datetime('now')), expires_at TEXT,
      FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);
}

function seedProject(): string {
  const id = randomUUID();
  memDb.prepare("INSERT INTO projects (id, name) VALUES (?, 'Test')").run(id);
  return id;
}

function seedUser(): string {
  const id = randomUUID();
  memDb.prepare("INSERT INTO users (id, username, display_name, avatar_color) VALUES (?, ?, ?, ?)")
    .run(id, `user_${id.slice(0, 4)}`, 'Test User', '#6366f1');
  return id;
}

function seedChapter(projectId: string): string {
  const id = randomUUID();
  memDb.prepare("INSERT INTO chapters (id, project_id, title, file_path) VALUES (?, ?, 'Ch1', ?)")
    .run(id, projectId, `${projectId}/${id}.md`);
  return id;
}

describe('lockManager', () => {
  beforeEach(() => {
    memDb = new Database(':memory:');
    memDb.pragma('foreign_keys = ON');
    setupTables();
  });

  describe('acquireLock', () => {
    it('acquires lock when no existing lock', () => {
      const projectId = seedProject();
      const userId = seedUser();
      const chapterId = seedChapter(projectId);

      const result = lockManager.acquireLock(chapterId, userId);

      expect(result).toBe(true);
    });

    it('re-acquires lock by same user (refresh)', () => {
      const projectId = seedProject();
      const userId = seedUser();
      const chapterId = seedChapter(projectId);

      lockManager.acquireLock(chapterId, userId);
      const result = lockManager.acquireLock(chapterId, userId);

      expect(result).toBe(true);
    });

    it('fails when another user holds the lock', () => {
      const projectId = seedProject();
      const userId1 = seedUser();
      const userId2 = seedUser();
      const chapterId = seedChapter(projectId);

      lockManager.acquireLock(chapterId, userId1);
      const result = lockManager.acquireLock(chapterId, userId2);

      expect(result).toBe(false);
    });
  });

  describe('releaseLock', () => {
    it('releases own lock', () => {
      const projectId = seedProject();
      const userId = seedUser();
      const chapterId = seedChapter(projectId);

      lockManager.acquireLock(chapterId, userId);
      const released = lockManager.releaseLock(chapterId, userId);

      expect(released).toBe(true);
      expect(lockManager.getLock(chapterId)).toBeNull();
    });

    it('returns false when no lock exists', () => {
      const userId = seedUser();
      const released = lockManager.releaseLock('nonexistent', userId);
      expect(released).toBe(false);
    });

    it('returns false when another user tries to release', () => {
      const projectId = seedProject();
      const userId1 = seedUser();
      const userId2 = seedUser();
      const chapterId = seedChapter(projectId);

      lockManager.acquireLock(chapterId, userId1);
      const released = lockManager.releaseLock(chapterId, userId2);

      expect(released).toBe(false);
    });
  });

  describe('getLock', () => {
    it('returns lock details when lock exists', () => {
      const projectId = seedProject();
      const userId = seedUser();
      const chapterId = seedChapter(projectId);

      lockManager.acquireLock(chapterId, userId);

      const lock = lockManager.getLock(chapterId);

      expect(lock).not.toBeNull();
      expect(lock!.chapterId).toBe(chapterId);
      expect(lock!.userId).toBe(userId);
      expect(lock!.lockedAt).toBeDefined();
    });

    it('returns null when no lock exists', () => {
      const lock = lockManager.getLock('nonexistent');
      expect(lock).toBeNull();
    });

    it('returns null and clears expired lock', () => {
      const projectId = seedProject();
      const userId = seedUser();
      const chapterId = seedChapter(projectId);

      // Insert an expired lock manually
      const expiredAt = new Date(Date.now() - 60000).toISOString();
      memDb.prepare(`
        INSERT INTO chapter_locks (chapter_id, user_id, locked_at, expires_at)
        VALUES (?, ?, datetime('now'), ?)
      `).run(chapterId, userId, expiredAt);

      const lock = lockManager.getLock(chapterId);

      expect(lock).toBeNull();
      // Verify the lock was cleaned up
      const row = memDb.prepare('SELECT * FROM chapter_locks WHERE chapter_id = ?').get(chapterId);
      expect(row).toBeUndefined();
    });
  });

  describe('getProjectLocks', () => {
    it('returns all locks for a project', () => {
      const projectId = seedProject();
      const userId = seedUser();
      const chapterId1 = seedChapter(projectId);
      const chapterId2 = seedChapter(projectId);

      lockManager.acquireLock(chapterId1, userId);
      lockManager.acquireLock(chapterId2, userId);

      const locks = lockManager.getProjectLocks(projectId);

      expect(locks).toHaveLength(2);
      const chapterIds = locks.map(l => l.chapterId);
      expect(chapterIds).toContain(chapterId1);
      expect(chapterIds).toContain(chapterId2);
    });

    it('returns empty array for project with no locks', () => {
      const projectId = seedProject();
      const locks = lockManager.getProjectLocks(projectId);
      expect(locks).toHaveLength(0);
    });
  });
});
