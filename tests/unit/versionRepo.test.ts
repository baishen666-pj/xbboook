import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';

let memDb: Database.Database;

vi.mock('../../server/db/database.js', () => ({
  getDb: () => memDb,
}));

import * as versionRepo from '../../server/db/repositories/versionRepo.js';

function setupTables(): void {
  memDb.exec(`
    CREATE TABLE projects (
      id TEXT PRIMARY KEY, name TEXT NOT NULL,
      status TEXT DEFAULT 'active', sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE volumes (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, title TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
    CREATE TABLE chapters (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, volume_id TEXT,
      title TEXT NOT NULL, word_count INTEGER DEFAULT 0, file_path TEXT NOT NULL,
      status TEXT DEFAULT 'draft', sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (volume_id) REFERENCES volumes(id) ON DELETE SET NULL
    );
    CREATE TABLE chapter_versions (
      id TEXT PRIMARY KEY,
      chapter_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      version_number INTEGER NOT NULL,
      content_hash TEXT NOT NULL,
      word_count INTEGER DEFAULT 0,
      snapshot_type TEXT DEFAULT 'auto',
      label TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_chapter_versions_chapter ON chapter_versions(chapter_id, version_number DESC);
  `);
}

function seedProject(): string {
  const id = randomUUID();
  memDb.prepare("INSERT INTO projects (id, name) VALUES (?, 'Test Novel')").run(id);
  return id;
}

function seedChapter(projectId: string, title = 'Ch1'): string {
  const id = randomUUID();
  memDb.prepare(
    `INSERT INTO chapters (id, project_id, volume_id, title, word_count, file_path, status, sort_order)
     VALUES (?, ?, NULL, ?, 0, ?, 'draft', 0)`,
  ).run(id, projectId, title, `${projectId}/ch/${id}.md`);
  return id;
}

describe('versionRepo', () => {
  beforeEach(() => {
    memDb = new Database(':memory:');
    memDb.pragma('foreign_keys = ON');
    setupTables();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (memDb) memDb.close();
  });

  describe('create', () => {
    it('creates a version with auto-incrementing version_number', () => {
      const projectId = seedProject();
      const chapterId = seedChapter(projectId);

      const v1 = versionRepo.create({
        chapterId, projectId,
        contentHash: 'abc123',
        wordCount: 1000,
        snapshotType: 'manual',
        label: 'First draft',
      });

      expect(v1).toBeDefined();
      expect(v1.version_number).toBe(1);
      expect(v1.content_hash).toBe('abc123');
      expect(v1.word_count).toBe(1000);
      expect(v1.snapshot_type).toBe('manual');
      expect(v1.label).toBe('First draft');

      const v2 = versionRepo.create({
        chapterId, projectId,
        contentHash: 'def456',
        wordCount: 1500,
        snapshotType: 'auto',
      });

      expect(v2.version_number).toBe(2);
      expect(v2.label).toBeNull();
    });

    it('sets default snapshot_type to auto', () => {
      const projectId = seedProject();
      const chapterId = seedChapter(projectId);

      const v = versionRepo.create({
        chapterId, projectId,
        contentHash: 'hash1',
        wordCount: 500,
        snapshotType: 'auto',
      });

      expect(v.snapshot_type).toBe('auto');
    });

    it('tracks versions per chapter independently', () => {
      const projectId = seedProject();
      const ch1 = seedChapter(projectId, 'Ch1');
      const ch2 = seedChapter(projectId, 'Ch2');

      const v1a = versionRepo.create({ chapterId: ch1, projectId, contentHash: 'h1', wordCount: 100, snapshotType: 'auto' });
      const v2a = versionRepo.create({ chapterId: ch2, projectId, contentHash: 'h2', wordCount: 200, snapshotType: 'auto' });
      const v1b = versionRepo.create({ chapterId: ch1, projectId, contentHash: 'h3', wordCount: 150, snapshotType: 'auto' });

      expect(v1a.version_number).toBe(1);
      expect(v2a.version_number).toBe(1);
      expect(v1b.version_number).toBe(2);
    });
  });

  describe('findByChapter', () => {
    it('returns versions ordered by version_number DESC', () => {
      const projectId = seedProject();
      const chapterId = seedChapter(projectId);

      versionRepo.create({ chapterId, projectId, contentHash: 'h1', wordCount: 100, snapshotType: 'auto' });
      versionRepo.create({ chapterId, projectId, contentHash: 'h2', wordCount: 200, snapshotType: 'auto' });
      versionRepo.create({ chapterId, projectId, contentHash: 'h3', wordCount: 300, snapshotType: 'manual', label: 'v3' });

      const versions = versionRepo.findByChapter(chapterId);

      expect(versions).toHaveLength(3);
      expect(versions[0].version_number).toBe(3);
      expect(versions[1].version_number).toBe(2);
      expect(versions[2].version_number).toBe(1);
    });

    it('respects limit option', () => {
      const projectId = seedProject();
      const chapterId = seedChapter(projectId);

      for (let i = 0; i < 5; i++) {
        versionRepo.create({ chapterId, projectId, contentHash: `h${i}`, wordCount: i * 100, snapshotType: 'auto' });
      }

      const versions = versionRepo.findByChapter(chapterId, { limit: 2 });

      expect(versions).toHaveLength(2);
      expect(versions[0].version_number).toBe(5);
    });

    it('respects offset option', () => {
      const projectId = seedProject();
      const chapterId = seedChapter(projectId);

      for (let i = 0; i < 5; i++) {
        versionRepo.create({ chapterId, projectId, contentHash: `h${i}`, wordCount: i * 100, snapshotType: 'auto' });
      }

      const versions = versionRepo.findByChapter(chapterId, { limit: 2, offset: 2 });

      expect(versions).toHaveLength(2);
      expect(versions[0].version_number).toBe(3);
      expect(versions[1].version_number).toBe(2);
    });

    it('returns empty array when no versions exist', () => {
      const projectId = seedProject();
      const chapterId = seedChapter(projectId);

      const versions = versionRepo.findByChapter(chapterId);

      expect(versions).toEqual([]);
    });
  });

  describe('findById', () => {
    it('returns the version by id', () => {
      const projectId = seedProject();
      const chapterId = seedChapter(projectId);

      const created = versionRepo.create({ chapterId, projectId, contentHash: 'abc', wordCount: 500, snapshotType: 'manual' });

      const found = versionRepo.findById(created.id);

      expect(found).toBeDefined();
      expect(found!.content_hash).toBe('abc');
    });

    it('returns undefined for non-existent id', () => {
      expect(versionRepo.findById('non-existent')).toBeUndefined();
    });
  });

  describe('findLatestVersionNumber', () => {
    it('returns 0 when no versions exist', () => {
      const projectId = seedProject();
      const chapterId = seedChapter(projectId);

      expect(versionRepo.findLatestVersionNumber(chapterId)).toBe(0);
    });

    it('returns the max version number', () => {
      const projectId = seedProject();
      const chapterId = seedChapter(projectId);

      versionRepo.create({ chapterId, projectId, contentHash: 'h1', wordCount: 100, snapshotType: 'auto' });
      versionRepo.create({ chapterId, projectId, contentHash: 'h2', wordCount: 200, snapshotType: 'auto' });

      expect(versionRepo.findLatestVersionNumber(chapterId)).toBe(2);
    });
  });

  describe('deleteByChapter', () => {
    it('deletes all versions for a chapter and returns count', () => {
      const projectId = seedProject();
      const chapterId = seedChapter(projectId);

      versionRepo.create({ chapterId, projectId, contentHash: 'h1', wordCount: 100, snapshotType: 'auto' });
      versionRepo.create({ chapterId, projectId, contentHash: 'h2', wordCount: 200, snapshotType: 'auto' });

      const deleted = versionRepo.deleteByChapter(chapterId);

      expect(deleted).toBe(2);
      expect(versionRepo.findByChapter(chapterId)).toHaveLength(0);
    });

    it('returns 0 when no versions exist', () => {
      const projectId = seedProject();
      const chapterId = seedChapter(projectId);

      expect(versionRepo.deleteByChapter(chapterId)).toBe(0);
    });
  });

  describe('deleteOldVersions', () => {
    it('deletes old versions keeping only the specified count', () => {
      const projectId = seedProject();
      const chapterId = seedChapter(projectId);

      for (let i = 0; i < 5; i++) {
        versionRepo.create({ chapterId, projectId, contentHash: `h${i}`, wordCount: i * 100, snapshotType: 'auto' });
      }

      const deleted = versionRepo.deleteOldVersions(chapterId, 2);

      expect(deleted).toBe(3);
      const remaining = versionRepo.findByChapter(chapterId);
      expect(remaining).toHaveLength(2);
      expect(remaining[0].version_number).toBe(5);
      expect(remaining[1].version_number).toBe(4);
    });

    it('returns 0 when total versions <= keepCount', () => {
      const projectId = seedProject();
      const chapterId = seedChapter(projectId);

      versionRepo.create({ chapterId, projectId, contentHash: 'h1', wordCount: 100, snapshotType: 'auto' });
      versionRepo.create({ chapterId, projectId, contentHash: 'h2', wordCount: 200, snapshotType: 'auto' });

      expect(versionRepo.deleteOldVersions(chapterId, 5)).toBe(0);
      expect(versionRepo.findByChapter(chapterId)).toHaveLength(2);
    });

    it('returns 0 when keepCount equals total versions', () => {
      const projectId = seedProject();
      const chapterId = seedChapter(projectId);

      versionRepo.create({ chapterId, projectId, contentHash: 'h1', wordCount: 100, snapshotType: 'auto' });
      versionRepo.create({ chapterId, projectId, contentHash: 'h2', wordCount: 200, snapshotType: 'auto' });

      expect(versionRepo.deleteOldVersions(chapterId, 2)).toBe(0);
    });
  });
});
