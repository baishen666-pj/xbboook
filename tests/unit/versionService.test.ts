import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';

let testDb: Database.Database;

vi.mock('../../server/db/database.js', () => ({
  getDb: () => testDb,
  closeDb: () => {},
}));

vi.mock('../../server/services/fileService.js', () => ({
  readVersion: vi.fn(),
  writeVersion: vi.fn(),
  deleteVersionFile: vi.fn(),
}));

vi.mock('../../server/db/repositories/chapterRepo.js', () => ({
  updateContent: vi.fn(),
}));

import * as versionRepo from '../../server/db/repositories/versionRepo.js';
import * as versionService from '../../server/services/versionService.js';
import * as fileService from '../../server/services/fileService.js';
import * as chapterRepo from '../../server/db/repositories/chapterRepo.js';

const mockFileService = fileService as unknown as Record<string, ReturnType<typeof vi.fn>>;
const mockChapterRepo = chapterRepo as unknown as Record<string, ReturnType<typeof vi.fn>>;

function createTestDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE projects (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT, genre TEXT,
      writing_style TEXT, writing_mode TEXT DEFAULT 'webnovel', target_words INTEGER,
      status TEXT DEFAULT 'active', sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE chapters (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, volume_id TEXT, title TEXT NOT NULL,
      summary TEXT, word_count INTEGER DEFAULT 0, file_path TEXT NOT NULL,
      status TEXT DEFAULT 'draft', sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
    CREATE TABLE chapter_versions (
      id TEXT PRIMARY KEY, chapter_id TEXT NOT NULL, project_id TEXT NOT NULL,
      version_number INTEGER NOT NULL, content_hash TEXT NOT NULL,
      word_count INTEGER DEFAULT 0, snapshot_type TEXT DEFAULT 'auto', label TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
    );
    CREATE TABLE writing_sessions (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, chapter_id TEXT NOT NULL,
      started_at TEXT NOT NULL, ended_at TEXT,
      words_start INTEGER DEFAULT 0, words_end INTEGER DEFAULT 0, duration_ms INTEGER DEFAULT 0,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
    );
    CREATE TABLE daily_stats (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, date TEXT NOT NULL,
      words_added INTEGER DEFAULT 0, words_total INTEGER DEFAULT 0,
      writing_time_ms INTEGER DEFAULT 0, chapters_worked INTEGER DEFAULT 0,
      UNIQUE(project_id, date)
    );
    CREATE TABLE project_members (
      project_id TEXT NOT NULL, user_id TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'writer', joined_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (project_id, user_id)
    );
    CREATE TABLE chapter_locks (
      chapter_id TEXT PRIMARY KEY, user_id TEXT NOT NULL,
      locked_at TEXT DEFAULT (datetime('now')), expires_at TEXT
    );
    CREATE TABLE chapter_comments (
      id TEXT PRIMARY KEY, chapter_id TEXT NOT NULL, project_id TEXT NOT NULL,
      user_id TEXT NOT NULL, content TEXT NOT NULL,
      selection_from INTEGER, selection_to INTEGER, selection_text TEXT,
      resolved INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
    );
  `);
  return db;
}

describe('versionService', () => {
  const projectId = 'proj-1';
  const chapterId = 'ch-1';

  beforeEach(() => {
    testDb = createTestDb();
    testDb.prepare(
      `INSERT INTO projects (id, name, genre, writing_mode, sort_order) VALUES (?, 'Test', 'fantasy', 'webnovel', 0)`,
    ).run(projectId);
    testDb.prepare(
      `INSERT INTO chapters (id, project_id, title, file_path, sort_order) VALUES (?, ?, 'Ch1', ?, 0)`,
    ).run(chapterId, projectId, `${projectId}/chapters/${chapterId}.md`);

    vi.clearAllMocks();
    mockFileService.writeVersion.mockResolvedValue(undefined);
    mockFileService.readVersion.mockResolvedValue('version content');
    mockFileService.deleteVersionFile.mockResolvedValue(undefined);
    mockChapterRepo.updateContent.mockReturnValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (testDb) testDb.close();
  });

  describe('saveVersion', () => {
    it('creates version when content changes', async () => {
      const version = await versionService.saveVersion(projectId, chapterId, 'new content', 'manual', 'Draft');
      expect(version).toBeDefined();
      expect(version!.snapshot_type).toBe('manual');
      expect(version!.label).toBe('Draft');
      expect(mockFileService.writeVersion).toHaveBeenCalled();
    });

    it('returns null when content unchanged', async () => {
      // Save once
      await versionService.saveVersion(projectId, chapterId, 'same content', 'auto');
      // Try again with same content
      const version = await versionService.saveVersion(projectId, chapterId, 'same content', 'auto');
      expect(version).toBeNull();
    });

    it('prunes old versions when exceeding 50', async () => {
      // Create 51 versions — each with unique content so hashes differ
      for (let i = 0; i < 52; i++) {
        await versionService.saveVersion(projectId, chapterId, `content version ${i} ${Date.now()}`, 'auto');
      }

      const all = versionRepo.findByChapter(chapterId);
      // Should be pruned to 50 or fewer
      expect(all.length).toBeLessThanOrEqual(50);
    });
  });

  describe('getVersionContent', () => {
    it('reads version file from disk', async () => {
      const content = await versionService.getVersionContent(projectId, chapterId, 1);
      expect(content).toBe('version content');
      expect(mockFileService.readVersion).toHaveBeenCalledWith(projectId, chapterId, 1);
    });
  });

  describe('rollbackToVersion', () => {
    it('restores content and creates rollback version', async () => {
      const v = await versionService.saveVersion(projectId, chapterId, 'original', 'manual');

      mockFileService.readVersion.mockResolvedValue('original');
      const content = await versionService.rollbackToVersion(projectId, chapterId, v!.id);

      expect(content).toBe('original');
      expect(mockChapterRepo.updateContent).toHaveBeenCalledWith(chapterId, 'original');
    });

    it('throws for non-existent version', async () => {
      await expect(
        versionService.rollbackToVersion(projectId, chapterId, 'nonexistent'),
      ).rejects.toThrow('版本不存在');
    });
  });

  describe('deleteVersion', () => {
    it('deletes version file and returns true', async () => {
      const v = await versionService.saveVersion(projectId, chapterId, 'content', 'manual');
      const result = await versionService.deleteVersion(projectId, chapterId, v!.id);
      expect(result).toBe(true);
      expect(mockFileService.deleteVersionFile).toHaveBeenCalled();
    });

    it('returns false for non-existent version', async () => {
      const result = await versionService.deleteVersion(projectId, chapterId, 'nonexistent');
      expect(result).toBe(false);
    });
  });
});
