import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';

let memDb: Database.Database;

vi.mock('../../server/db/database.js', () => ({
  getDb: () => memDb,
}));

import * as repo from '../../server/db/repositories/sprintRepo.js';

function setupTables(): void {
  memDb.exec(`
    CREATE TABLE projects (
      id TEXT PRIMARY KEY, name TEXT NOT NULL,
      status TEXT DEFAULT 'active', sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE writing_sprints (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      user_id TEXT DEFAULT 'default',
      type TEXT NOT NULL DEFAULT 'pomodoro' CHECK(type IN ('pomodoro','sprint','marathon','custom')),
      duration_minutes INTEGER NOT NULL DEFAULT 25,
      target_words INTEGER DEFAULT 0,
      actual_words INTEGER DEFAULT 0,
      status TEXT DEFAULT 'planned' CHECK(status IN ('planned','active','paused','completed','abandoned')),
      started_at TEXT,
      ended_at TEXT,
      notes TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
    CREATE TABLE sprint_stats (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      user_id TEXT DEFAULT 'default',
      date TEXT NOT NULL,
      total_sprints INTEGER DEFAULT 0,
      total_minutes INTEGER DEFAULT 0,
      total_words INTEGER DEFAULT 0,
      best_wpm REAL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      UNIQUE(project_id, user_id, date)
    );
  `);
}

function seedProject(): string {
  const id = randomUUID();
  memDb.prepare("INSERT INTO projects (id, name) VALUES (?, 'Test')").run(id);
  return id;
}

describe('sprintRepo', () => {
  beforeEach(() => {
    memDb = new Database(':memory:');
    memDb.pragma('foreign_keys = ON');
    setupTables();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (memDb) memDb.close();
  });

  describe('create + findByProject', () => {
    it('creates a sprint and retrieves it', () => {
      const pid = seedProject();
      const sprint = repo.create({ id: randomUUID(), projectId: pid, type: 'pomodoro', durationMinutes: 25 });
      expect(sprint.type).toBe('pomodoro');
      expect(sprint.status).toBe('planned');
      expect(repo.findByProject(pid)).toHaveLength(1);
    });

    it('filters by status', () => {
      const pid = seedProject();
      repo.create({ id: randomUUID(), projectId: pid, type: 'pomodoro', durationMinutes: 25 });
      expect(repo.findByProject(pid, 'planned')).toHaveLength(1);
      expect(repo.findByProject(pid, 'active')).toHaveLength(0);
    });
  });

  describe('lifecycle', () => {
    it('starts a sprint', () => {
      const pid = seedProject();
      const sprint = repo.create({ id: randomUUID(), projectId: pid, type: 'pomodoro', durationMinutes: 25 });
      const started = repo.startSprint(sprint.id);
      expect(started!.status).toBe('active');
      expect(started!.startedAt).toBeTruthy();
    });

    it('pauses and resumes', () => {
      const pid = seedProject();
      const sprint = repo.create({ id: randomUUID(), projectId: pid, type: 'pomodoro', durationMinutes: 25 });
      repo.startSprint(sprint.id);
      const paused = repo.pauseSprint(sprint.id);
      expect(paused!.status).toBe('paused');
      const resumed = repo.resumeSprint(sprint.id);
      expect(resumed!.status).toBe('active');
    });

    it('completes a sprint and updates stats', () => {
      const pid = seedProject();
      const sprint = repo.create({ id: randomUUID(), projectId: pid, type: 'pomodoro', durationMinutes: 25, targetWords: 500 });
      repo.startSprint(sprint.id);
      const completed = repo.completeSprint(sprint.id, 450, 'Good session');
      expect(completed!.status).toBe('completed');
      expect(completed!.actualWords).toBe(450);
      expect(completed!.notes).toBe('Good session');

      const stats = repo.getStats(pid);
      expect(stats).toHaveLength(1);
      expect(stats[0].totalSprints).toBe(1);
      expect(stats[0].totalWords).toBe(450);
    });

    it('abandons a sprint', () => {
      const pid = seedProject();
      const sprint = repo.create({ id: randomUUID(), projectId: pid, type: 'pomodoro', durationMinutes: 25 });
      repo.startSprint(sprint.id);
      const abandoned = repo.abandonSprint(sprint.id);
      expect(abandoned!.status).toBe('abandoned');
    });
  });

  describe('remove', () => {
    it('deletes a sprint', () => {
      const pid = seedProject();
      const sprint = repo.create({ id: randomUUID(), projectId: pid, type: 'pomodoro', durationMinutes: 25 });
      expect(repo.remove(sprint.id)).toBe(true);
      expect(repo.findByProject(pid)).toHaveLength(0);
    });
  });

  describe('getStats', () => {
    it('returns stats for date range', () => {
      const pid = seedProject();
      const sprint = repo.create({ id: randomUUID(), projectId: pid, type: 'pomodoro', durationMinutes: 25 });
      repo.startSprint(sprint.id);
      repo.completeSprint(sprint.id, 300);

      const stats = repo.getStats(pid, 7);
      expect(stats).toHaveLength(1);
      expect(stats[0].totalWords).toBe(300);
      expect(stats[0].bestWpm).toBeGreaterThanOrEqual(0);
    });
  });
});
