import { describe, it, expect, vi, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';

let memDb: Database.Database;

vi.mock('../../server/db/database.js', () => ({
  getDb: () => memDb,
}));

vi.mock('../../server/db/repositories/sessionRepo.js', () => ({
  getHourlyDistribution: (_projectId: string, _days: number) => {
    const result: { hour: number; count: number }[] = [];
    for (let h = 0; h < 24; h++) {
      result.push({ hour: h, count: h >= 9 && h <= 14 ? h - 8 : 0 });
    }
    return result;
  },
}));

import * as insightsService from '../../server/services/writingInsightsService.js';

function setupTables(): void {
  memDb.exec(`
    CREATE TABLE projects (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, genre TEXT,
      writing_mode TEXT DEFAULT 'webnovel', target_words INTEGER,
      status TEXT DEFAULT 'active', sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
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
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
    CREATE TABLE chat_messages (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, chapter_id TEXT,
      role TEXT NOT NULL CHECK(role IN ('user','assistant','system')),
      content TEXT NOT NULL,
      skill_id TEXT DEFAULT '',
      token_usage INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
    CREATE TABLE chapters (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, volume_id TEXT, title TEXT NOT NULL,
      word_count INTEGER DEFAULT 0, file_path TEXT NOT NULL,
      status TEXT DEFAULT 'draft', sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
  `);
}

function seedProject(): string {
  const id = randomUUID();
  memDb.prepare("INSERT INTO projects (id, name) VALUES (?, 'Test')").run(id);
  return id;
}

function seedStat(projectId: string, date: string, wordsAdded: number): void {
  const id = randomUUID();
  memDb.prepare(
    "INSERT INTO daily_stats (id, project_id, date, words_added, words_total) VALUES (?, ?, ?, ?, 0)"
  ).run(id, projectId, date, wordsAdded);
}

function seedChatMessage(projectId: string, role: string, createdAt: string): void {
  const id = randomUUID();
  memDb.prepare(
    "INSERT INTO chat_messages (id, project_id, role, content, created_at) VALUES (?, ?, ?, 'test', ?)"
  ).run(id, projectId, role, createdAt);
}

function seedSession(projectId: string, startedAt: string, durationMs: number, wordsDelta: number): void {
  const id = randomUUID();
  memDb.prepare(
    "INSERT INTO writing_sessions (id, project_id, chapter_id, started_at, ended_at, words_start, words_end, duration_ms) VALUES (?, ?, 'ch1', ?, ?, 0, ?, ?)"
  ).run(id, projectId, startedAt, startedAt, wordsDelta, durationMs);
}

describe('writingInsightsService', () => {
  beforeEach(() => {
    memDb = new Database(':memory:');
    memDb.pragma('foreign_keys = ON');
    setupTables();
  });

  describe('getWritingTrends', () => {
    it('returns daily trend for week period', () => {
      const projectId = seedProject();
      const today = new Date().toISOString().slice(0, 10);
      seedStat(projectId, today, 800);

      const trends = insightsService.getWritingTrends(projectId, 'week');

      expect(trends).toHaveLength(1);
      expect(trends[0].words).toBe(800);
      expect(trends[0].label).toBe(today.slice(5));
    });

    it('returns empty when no stats', () => {
      const projectId = seedProject();
      const trends = insightsService.getWritingTrends(projectId, 'week');
      expect(trends).toHaveLength(0);
    });

    it('returns weekly buckets for month period', () => {
      const projectId = seedProject();
      const today = new Date();
      for (let i = 0; i < 14; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        seedStat(projectId, d.toISOString().slice(0, 10), 100);
      }

      const trends = insightsService.getWritingTrends(projectId, 'month');

      expect(trends.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('getAiUsageRate', () => {
    it('returns zero rate when no data', () => {
      const projectId = seedProject();
      const result = insightsService.getAiUsageRate(projectId, 'week');

      expect(result.totalWords).toBe(0);
      expect(result.aiMessages).toBe(0);
      expect(result.rate).toBe(0);
    });

    it('computes AI usage rate', () => {
      const projectId = seedProject();
      const today = new Date().toISOString().slice(0, 10);
      seedStat(projectId, today, 1000);
      seedChatMessage(projectId, 'assistant', new Date().toISOString());
      seedChatMessage(projectId, 'assistant', new Date().toISOString());
      seedChatMessage(projectId, 'user', new Date().toISOString());

      const result = insightsService.getAiUsageRate(projectId, 'week');

      expect(result.totalWords).toBe(1000);
      expect(result.aiMessages).toBe(2);
      expect(result.rate).toBeGreaterThan(0);
    });
  });

  describe('getWritingHabits', () => {
    it('returns zero values when no data', () => {
      const projectId = seedProject();
      const habits = insightsService.getWritingHabits(projectId);

      expect(habits.consistencyScore).toBe(0);
      expect(habits.optimalSessionLength).toBe(0);
      expect(habits.peakHours).toHaveLength(24);
    });

    it('computes consistency score', () => {
      const projectId = seedProject();
      const today = new Date();
      for (let i = 0; i < 5; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        seedStat(projectId, d.toISOString().slice(0, 10), 200);
      }

      const habits = insightsService.getWritingHabits(projectId);

      expect(habits.consistencyScore).toBeGreaterThan(0);
    });

    it('computes optimal session length', () => {
      const projectId = seedProject();
      seedSession(projectId, new Date().toISOString(), 1800000, 500);
      seedSession(projectId, new Date(Date.now() - 3600000).toISOString(), 2400000, 600);

      const habits = insightsService.getWritingHabits(projectId);

      expect(habits.optimalSessionLength).toBe(35);
    });
  });

  describe('getProductivity', () => {
    it('returns zeroed values when no data', () => {
      const projectId = seedProject();
      const prod = insightsService.getProductivity(projectId);

      expect(prod.avgWordsPerSession).toBe(0);
      expect(prod.bestDay).toBeNull();
      expect(prod.avgIntervalDays).toBe(0);
    });

    it('computes avg words per session', () => {
      const projectId = seedProject();
      seedSession(projectId, new Date().toISOString(), 1800000, 500);
      seedSession(projectId, new Date(Date.now() - 3600000).toISOString(), 1800000, 300);

      const prod = insightsService.getProductivity(projectId);

      expect(prod.avgWordsPerSession).toBe(400);
    });

    it('computes best day', () => {
      const projectId = seedProject();
      const today = new Date().toISOString().slice(0, 10);
      seedStat(projectId, today, 1500);
      seedStat(projectId, new Date(Date.now() - 86400000).toISOString().slice(0, 10), 800);

      const prod = insightsService.getProductivity(projectId);

      expect(prod.bestDay).not.toBeNull();
      expect(prod.bestDay!.words).toBe(1500);
    });

    it('computes avg interval', () => {
      const projectId = seedProject();
      const today = new Date();
      seedStat(projectId, today.toISOString().slice(0, 10), 100);
      seedStat(projectId, new Date(today.getTime() - 86400000 * 2).toISOString().slice(0, 10), 100);
      seedStat(projectId, new Date(today.getTime() - 86400000 * 4).toISOString().slice(0, 10), 100);

      const prod = insightsService.getProductivity(projectId);

      expect(prod.avgIntervalDays).toBe(2);
    });
  });
});
