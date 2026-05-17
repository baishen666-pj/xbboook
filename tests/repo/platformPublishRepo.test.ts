import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';

let memDb: Database.Database;

vi.mock('../../server/db/database.js', () => ({
  getDb: () => memDb,
}));

import * as repo from '../../server/db/repositories/platformPublishRepo.js';

function setupTables(): void {
  memDb.exec(`
    CREATE TABLE projects (
      id TEXT PRIMARY KEY, name TEXT NOT NULL,
      status TEXT DEFAULT 'active', sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE platform_publish_configs (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      platform TEXT NOT NULL CHECK(platform IN ('qidian','fanqie','jinjiang','zongheng','other')),
      config TEXT NOT NULL DEFAULT '{}',
      last_export_at TEXT,
      chapter_mapping TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      UNIQUE(project_id, platform)
    );
  `);
}

function seedProject(): string {
  const id = randomUUID();
  memDb.prepare("INSERT INTO projects (id, name) VALUES (?, 'Test')").run(id);
  return id;
}

describe('platformPublishRepo', () => {
  beforeEach(() => {
    memDb = new Database(':memory:');
    memDb.pragma('foreign_keys = ON');
    setupTables();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (memDb) memDb.close();
  });

  describe('upsert + findByProject', () => {
    it('creates a config', () => {
      const pid = seedProject();
      const config = repo.upsert({ id: randomUUID(), projectId: pid, platform: 'qidian', config: { maxLength: 3000 } });
      expect(config.platform).toBe('qidian');
      expect(config.config).toEqual({ maxLength: 3000 });
    });

    it('updates existing config', () => {
      const pid = seedProject();
      repo.upsert({ id: randomUUID(), projectId: pid, platform: 'fanqie', config: { indent: '　　' } });
      const updated = repo.upsert({ id: randomUUID(), projectId: pid, platform: 'fanqie', config: { indent: '  ' } });
      expect(updated.config).toEqual({ indent: '  ' });
      expect(repo.findByProject(pid)).toHaveLength(1);
    });

    it('finds all configs for project', () => {
      const pid = seedProject();
      repo.upsert({ id: randomUUID(), projectId: pid, platform: 'qidian' });
      repo.upsert({ id: randomUUID(), projectId: pid, platform: 'fanqie' });
      expect(repo.findByProject(pid)).toHaveLength(2);
    });
  });

  describe('findByPlatform', () => {
    it('returns config for specific platform', () => {
      const pid = seedProject();
      repo.upsert({ id: randomUUID(), projectId: pid, platform: 'jinjiang' });
      const found = repo.findByPlatform(pid, 'jinjiang');
      expect(found).toBeDefined();
      expect(found!.platform).toBe('jinjiang');
    });

    it('returns undefined for non-existent platform', () => {
      const pid = seedProject();
      expect(repo.findByPlatform(pid, 'qidian')).toBeUndefined();
    });
  });

  describe('updateLastExport', () => {
    it('updates last export timestamp', () => {
      const pid = seedProject();
      repo.upsert({ id: randomUUID(), projectId: pid, platform: 'qidian' });
      repo.updateLastExport(pid, 'qidian');
      const config = repo.findByPlatform(pid, 'qidian');
      expect(config!.lastExportAt).toBeTruthy();
    });
  });

  describe('remove', () => {
    it('removes a config', () => {
      const pid = seedProject();
      repo.upsert({ id: randomUUID(), projectId: pid, platform: 'qidian' });
      expect(repo.remove(pid, 'qidian')).toBe(true);
      expect(repo.findByProject(pid)).toHaveLength(0);
    });

    it('returns false for non-existent', () => {
      const pid = seedProject();
      expect(repo.remove(pid, 'qidian')).toBe(false);
    });
  });
});
