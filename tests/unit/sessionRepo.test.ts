import { describe, it, expect, vi, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';

// In-memory DB mock
let memDb: Database.Database;

vi.mock('../../server/db/database.js', () => ({
  getDb: () => memDb,
}));

// Must import after mock setup
import * as sessionRepo from '../../server/db/repositories/sessionRepo.js';

function setupTables(): void {
  memDb.exec(`
    CREATE TABLE projects (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, genre TEXT,
      writing_mode TEXT DEFAULT 'webnovel', target_words INTEGER,
      status TEXT DEFAULT 'active', sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE chapters (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, volume_id TEXT, title TEXT NOT NULL,
      word_count INTEGER DEFAULT 0, file_path TEXT NOT NULL,
      status TEXT DEFAULT 'draft', sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
    CREATE TABLE writing_sessions (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, chapter_id TEXT NOT NULL,
      started_at TEXT NOT NULL, ended_at TEXT,
      words_start INTEGER DEFAULT 0, words_end INTEGER DEFAULT 0, duration_ms INTEGER DEFAULT 0,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
    );
  `);
}

function seedProject(): string {
  const id = randomUUID();
  memDb.prepare("INSERT INTO projects (id, name) VALUES (?, 'Test')").run(id);
  return id;
}

function seedChapter(projectId: string): string {
  const id = randomUUID();
  memDb.prepare("INSERT INTO chapters (id, project_id, title, file_path) VALUES (?, ?, 'Ch1', ?)").run(id, projectId, `${projectId}/${id}.md`);
  return id;
}

describe('sessionRepo', () => {
  beforeEach(() => {
    memDb = new Database(':memory:');
    memDb.pragma('foreign_keys = ON');
    setupTables();
  });

  describe('create', () => {
    it('creates a writing session and returns it', () => {
      const projectId = seedProject();
      const chapterId = seedChapter(projectId);
      const startedAt = '2026-01-15T10:00:00.000Z';

      const session = sessionRepo.create({ projectId, chapterId, startedAt, wordsStart: 100 });

      expect(session).toBeDefined();
      expect(session.id).toBeDefined();
      expect(session.project_id).toBe(projectId);
      expect(session.chapter_id).toBe(chapterId);
      expect(session.started_at).toBe(startedAt);
      expect(session.words_start).toBe(100);
      expect(session.ended_at).toBeNull();
    });
  });

  describe('findById', () => {
    it('returns the session when found', () => {
      const projectId = seedProject();
      const chapterId = seedChapter(projectId);
      const created = sessionRepo.create({ projectId, chapterId, startedAt: new Date().toISOString(), wordsStart: 0 });

      const found = sessionRepo.findById(created.id);

      expect(found).toBeDefined();
      expect(found!.id).toBe(created.id);
    });

    it('returns undefined for non-existent session', () => {
      const result = sessionRepo.findById('nonexistent');
      expect(result).toBeUndefined();
    });
  });

  describe('endSession', () => {
    it('ends a session and calculates duration', () => {
      const projectId = seedProject();
      const chapterId = seedChapter(projectId);
      const startedAt = new Date(Date.now() - 60000).toISOString();
      const created = sessionRepo.create({ projectId, chapterId, startedAt, wordsStart: 100 });

      const ended = sessionRepo.endSession(created.id, 350);

      expect(ended).toBeDefined();
      expect(ended!.ended_at).not.toBeNull();
      expect(ended!.words_end).toBe(350);
      expect(ended!.duration_ms).toBeGreaterThan(0);
    });

    it('returns undefined for non-existent session', () => {
      const result = sessionRepo.endSession('nonexistent', 100);
      expect(result).toBeUndefined();
    });
  });

  describe('getRecentSessions', () => {
    it('returns recent sessions for a project', () => {
      const projectId = seedProject();
      const chapterId = seedChapter(projectId);
      sessionRepo.create({ projectId, chapterId, startedAt: new Date().toISOString(), wordsStart: 0 });
      sessionRepo.create({ projectId, chapterId, startedAt: new Date().toISOString(), wordsStart: 100 });

      const sessions = sessionRepo.getRecentSessions(projectId);

      expect(sessions).toHaveLength(2);
    });

    it('respects limit parameter', () => {
      const projectId = seedProject();
      const chapterId = seedChapter(projectId);
      for (let i = 0; i < 5; i++) {
        sessionRepo.create({ projectId, chapterId, startedAt: new Date(Date.now() + i).toISOString(), wordsStart: 0 });
      }

      const sessions = sessionRepo.getRecentSessions(projectId, 3);
      expect(sessions).toHaveLength(3);
    });

    it('returns empty for project with no sessions', () => {
      const projectId = seedProject();
      const sessions = sessionRepo.getRecentSessions(projectId);
      expect(sessions).toHaveLength(0);
    });
  });

  describe('getHourlyDistribution', () => {
    it('returns 24-hour distribution with zeros for no sessions', () => {
      const projectId = seedProject();
      const dist = sessionRepo.getHourlyDistribution(projectId);

      expect(dist).toHaveLength(24);
      expect(dist.every(d => d.count === 0)).toBe(true);
    });

    it('returns correct distribution with sessions', () => {
      const projectId = seedProject();
      const chapterId = seedChapter(projectId);

      // Insert sessions at specific hours using raw SQL for deterministic control
      // Use UTC ISO strings to match SQLite's strftime('%H')
      const hour10 = '2026-05-16T10:00:00.000Z';
      const hour14 = '2026-05-16T14:00:00.000Z';

      memDb.prepare(
        "INSERT INTO writing_sessions (id, project_id, chapter_id, started_at, words_start) VALUES (?, ?, ?, ?, 0)"
      ).run(randomUUID(), projectId, chapterId, hour10);
      memDb.prepare(
        "INSERT INTO writing_sessions (id, project_id, chapter_id, started_at, words_start) VALUES (?, ?, ?, ?, 0)"
      ).run(randomUUID(), projectId, chapterId, hour10);
      memDb.prepare(
        "INSERT INTO writing_sessions (id, project_id, chapter_id, started_at, words_start) VALUES (?, ?, ?, ?, 0)"
      ).run(randomUUID(), projectId, chapterId, hour14);

      const dist = sessionRepo.getHourlyDistribution(projectId, 365);

      expect(dist).toHaveLength(24);
      expect(dist[10].count).toBe(2);
      expect(dist[14].count).toBe(1);
      expect(dist[0].count).toBe(0);
    });
  });

  describe('getDailyWritingStats', () => {
    it('returns daily aggregated stats', () => {
      const projectId = seedProject();
      const chapterId = seedChapter(projectId);

      const date = new Date().toISOString().slice(0, 10);

      memDb.prepare(`
        INSERT INTO writing_sessions (id, project_id, chapter_id, started_at, ended_at, words_start, words_end, duration_ms)
        VALUES (?, ?, ?, ?, datetime('now'), 100, 350, 250000)
      `).run(randomUUID(), projectId, chapterId, new Date().toISOString());
      memDb.prepare(`
        INSERT INTO writing_sessions (id, project_id, chapter_id, started_at, ended_at, words_start, words_end, duration_ms)
        VALUES (?, ?, ?, ?, datetime('now'), 350, 600, 180000)
      `).run(randomUUID(), projectId, chapterId, new Date().toISOString());

      const stats = sessionRepo.getDailyWritingStats(projectId);

      expect(stats.length).toBeGreaterThanOrEqual(1);
      const today = stats.find(s => s.date === date);
      expect(today).toBeDefined();
      expect(today!.words).toBe(500); // (350-100) + (600-350) = 250 + 250
      expect(today!.sessions).toBe(2);
    });

    it('excludes sessions without ended_at', () => {
      const projectId = seedProject();
      const chapterId = seedChapter(projectId);

      // Open session (no ended_at)
      memDb.prepare(`
        INSERT INTO writing_sessions (id, project_id, chapter_id, started_at, words_start)
        VALUES (?, ?, ?, ?, 0)
      `).run(randomUUID(), projectId, chapterId, new Date().toISOString());

      const stats = sessionRepo.getDailyWritingStats(projectId);
      expect(stats).toHaveLength(0);
    });

    it('returns empty for project with no sessions', () => {
      const projectId = seedProject();
      const stats = sessionRepo.getDailyWritingStats(projectId);
      expect(stats).toHaveLength(0);
    });
  });
});
