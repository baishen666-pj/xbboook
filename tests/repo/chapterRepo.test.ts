import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';

let memDb: Database.Database;

vi.mock('../../server/db/database.js', () => ({
  getDb: () => memDb,
}));

vi.mock('../../server/services/fileService.js', () => ({
  writeChapter: vi.fn().mockResolvedValue(undefined),
  deleteChapter: vi.fn().mockResolvedValue(undefined),
}));

import * as chapterRepo from '../../server/db/repositories/chapterRepo.js';

function setupTables(): void {
  memDb.exec(`
    CREATE TABLE projects (
      id TEXT PRIMARY KEY, name TEXT NOT NULL,
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
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      volume_id TEXT,
      title TEXT NOT NULL,
      summary TEXT,
      word_count INTEGER DEFAULT 0,
      file_path TEXT NOT NULL,
      status TEXT DEFAULT 'draft',
      publish_status TEXT DEFAULT 'draft' CHECK(publish_status IN ('draft','scheduled','published','archived')),
      scheduled_at TEXT,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (volume_id) REFERENCES volumes(id) ON DELETE SET NULL
    );
  `);
}

function seedProject(): string {
  const id = randomUUID();
  memDb.prepare("INSERT INTO projects (id, name) VALUES (?, 'Test Novel')").run(id);
  return id;
}

function seedVolume(projectId: string): string {
  const id = randomUUID();
  memDb
    .prepare('INSERT INTO volumes (id, project_id, title) VALUES (?, ?, ?)')
    .run(id, projectId, 'Volume 1');
  return id;
}

describe('chapterRepo', () => {
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
    it('creates a chapter with minimal data', async () => {
      const projectId = seedProject();

      const chapter = await chapterRepo.create({ projectId, title: 'Chapter 1' });

      expect(chapter).toBeDefined();
      expect(chapter.id).toBeTruthy();
      expect(chapter.title).toBe('Chapter 1');
      expect(chapter.project_id).toBe(projectId);
      expect(chapter.status).toBe('draft');
      expect(chapter.publish_status).toBe('draft');
      expect(chapter.word_count).toBe(0);
      expect(chapter.sort_order).toBe(0);
      expect(chapter.summary).toBeNull();
      expect(chapter.volume_id).toBeNull();
    });

    it('creates a chapter with summary and volume', async () => {
      const projectId = seedProject();
      const volumeId = seedVolume(projectId);

      const chapter = await chapterRepo.create({
        projectId,
        title: 'Chapter 1',
        volumeId,
        summary: 'The hero arrives',
      });

      expect(chapter.summary).toBe('The hero arrives');
      expect(chapter.volume_id).toBe(volumeId);
    });

    it('auto-increments sort_order per project', async () => {
      const projectId = seedProject();

      const c1 = await chapterRepo.create({ projectId, title: 'Ch1' });
      const c2 = await chapterRepo.create({ projectId, title: 'Ch2' });
      const c3 = await chapterRepo.create({ projectId, title: 'Ch3' });

      expect(c1.sort_order).toBe(0);
      expect(c2.sort_order).toBe(1);
      expect(c3.sort_order).toBe(2);
    });

    it('sort_order is independent per project', async () => {
      const p1 = seedProject();
      const p2 = seedProject();

      const c1 = await chapterRepo.create({ projectId: p1, title: 'P1-Ch1' });
      const c2 = await chapterRepo.create({ projectId: p2, title: 'P2-Ch1' });

      expect(c1.sort_order).toBe(0);
      expect(c2.sort_order).toBe(0);
    });

    it('generates a file_path based on project and chapter id', async () => {
      const projectId = seedProject();

      const chapter = await chapterRepo.create({ projectId, title: 'Ch1' });

      expect(chapter.file_path).toContain(projectId);
      expect(chapter.file_path).toContain(chapter.id);
      expect(chapter.file_path).toMatch(/\.md$/);
    });
  });

  describe('findByProject', () => {
    it('returns chapters ordered by sort_order then created_at', async () => {
      const projectId = seedProject();

      await chapterRepo.create({ projectId, title: 'First' });
      await chapterRepo.create({ projectId, title: 'Second' });

      const chapters = chapterRepo.findByProject(projectId);

      expect(chapters).toHaveLength(2);
      expect(chapters[0].sort_order).toBeLessThan(chapters[1].sort_order);
    });

    it('returns empty array when no chapters exist', () => {
      const projectId = seedProject();

      expect(chapterRepo.findByProject(projectId)).toEqual([]);
    });

    it('only returns chapters for the specified project', async () => {
      const p1 = seedProject();
      const p2 = seedProject();

      await chapterRepo.create({ projectId: p1, title: 'P1-Only' });
      await chapterRepo.create({ projectId: p2, title: 'P2-Only' });

      const chapters = chapterRepo.findByProject(p1);

      expect(chapters).toHaveLength(1);
      expect(chapters[0].title).toBe('P1-Only');
    });
  });

  describe('findById', () => {
    it('returns chapter by id', async () => {
      const projectId = seedProject();
      const created = await chapterRepo.create({ projectId, title: 'Find Me' });

      const found = chapterRepo.findById(created.id);

      expect(found).toBeDefined();
      expect(found!.title).toBe('Find Me');
    });

    it('returns undefined for non-existent id', () => {
      expect(chapterRepo.findById('non-existent')).toBeUndefined();
    });
  });

  describe('update', () => {
    it('updates title', async () => {
      const projectId = seedProject();
      const created = await chapterRepo.create({ projectId, title: 'Original' });

      const updated = chapterRepo.update(created.id, { title: 'Updated Title' });

      expect(updated!.title).toBe('Updated Title');
    });

    it('updates summary', async () => {
      const projectId = seedProject();
      const created = await chapterRepo.create({ projectId, title: 'Ch1' });

      const updated = chapterRepo.update(created.id, { summary: 'New summary' });

      expect(updated!.summary).toBe('New summary');
    });

    it('updates status', async () => {
      const projectId = seedProject();
      const created = await chapterRepo.create({ projectId, title: 'Ch1' });

      const updated = chapterRepo.update(created.id, { status: 'completed' });

      expect(updated!.status).toBe('completed');
    });

    it('updates publish_status', async () => {
      const projectId = seedProject();
      const created = await chapterRepo.create({ projectId, title: 'Ch1' });

      const updated = chapterRepo.update(created.id, { publish_status: 'published' });

      expect(updated!.publish_status).toBe('published');
    });

    it('updates volume_id', async () => {
      const projectId = seedProject();
      const volumeId = seedVolume(projectId);
      const created = await chapterRepo.create({ projectId, title: 'Ch1' });

      const updated = chapterRepo.update(created.id, { volume_id: volumeId });

      expect(updated!.volume_id).toBe(volumeId);
    });

    it('sets volume_id to null', async () => {
      const projectId = seedProject();
      const volumeId = seedVolume(projectId);
      const created = await chapterRepo.create({ projectId, title: 'Ch1', volumeId });

      const updated = chapterRepo.update(created.id, { volume_id: null });

      expect(updated!.volume_id).toBeNull();
    });

    it('updates sort_order', async () => {
      const projectId = seedProject();
      const created = await chapterRepo.create({ projectId, title: 'Ch1' });

      const updated = chapterRepo.update(created.id, { sort_order: 5 });

      expect(updated!.sort_order).toBe(5);
    });

    it('updates multiple fields at once', async () => {
      const projectId = seedProject();
      const created = await chapterRepo.create({ projectId, title: 'Original' });

      const updated = chapterRepo.update(created.id, {
        title: 'New',
        summary: 'Desc',
        sort_order: 3,
        status: 'completed',
      });

      expect(updated!.title).toBe('New');
      expect(updated!.summary).toBe('Desc');
      expect(updated!.sort_order).toBe(3);
      expect(updated!.status).toBe('completed');
    });

    it('returns undefined for non-existent chapter', () => {
      expect(chapterRepo.update('non-existent', { title: 'X' })).toBeUndefined();
    });

    it('returns existing chapter when no valid fields provided', async () => {
      const projectId = seedProject();
      const created = await chapterRepo.create({ projectId, title: 'Same' });

      const result = chapterRepo.update(created.id, { unknown_field: 'ignored' } as Record<string, unknown>);

      expect(result).toBeDefined();
      expect(result!.title).toBe('Same');
    });

    it('updates updated_at timestamp', async () => {
      const projectId = seedProject();
      const created = await chapterRepo.create({ projectId, title: 'Ch1' });
      const originalUpdatedAt = created.updated_at;

      const updated = chapterRepo.update(created.id, { title: 'Ch1-Updated' });

      expect(updated!.updated_at).not.toBe(originalUpdatedAt);
    });
  });

  describe('updateContent', () => {
    it('updates word_count based on content length', async () => {
      const projectId = seedProject();
      const created = await chapterRepo.create({ projectId, title: 'Ch1' });

      const content = 'Hello world, this is chapter content.';
      const updated = await chapterRepo.updateContent(created.id, content);

      expect(updated!.word_count).toBe(content.length);
    });

    it('returns undefined for non-existent chapter', async () => {
      const result = await chapterRepo.updateContent('non-existent', 'text');

      expect(result).toBeUndefined();
    });

    it('sets word_count to 0 for empty content', async () => {
      const projectId = seedProject();
      const created = await chapterRepo.create({ projectId, title: 'Ch1' });

      const updated = await chapterRepo.updateContent(created.id, '');

      expect(updated!.word_count).toBe(0);
    });
  });

  describe('deleteById', () => {
    it('deletes a chapter and returns true', async () => {
      const projectId = seedProject();
      const created = await chapterRepo.create({ projectId, title: 'Delete Me' });

      expect(await chapterRepo.deleteById(created.id)).toBe(true);
      expect(chapterRepo.findById(created.id)).toBeUndefined();
    });

    it('returns false for non-existent chapter', async () => {
      expect(await chapterRepo.deleteById('non-existent')).toBe(false);
    });

    it('does not affect other chapters', async () => {
      const projectId = seedProject();
      const c1 = await chapterRepo.create({ projectId, title: 'Keep' });
      const c2 = await chapterRepo.create({ projectId, title: 'Delete' });

      await chapterRepo.deleteById(c2.id);

      const remaining = chapterRepo.findByProject(projectId);
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe(c1.id);
    });
  });

  describe('reorder', () => {
    it('updates sort_order for multiple chapters in a transaction', async () => {
      const projectId = seedProject();
      const c1 = await chapterRepo.create({ projectId, title: 'Ch1' });
      const c2 = await chapterRepo.create({ projectId, title: 'Ch2' });
      const c3 = await chapterRepo.create({ projectId, title: 'Ch3' });

      chapterRepo.reorder([
        { id: c3.id, sortOrder: 0 },
        { id: c2.id, sortOrder: 1 },
        { id: c1.id, sortOrder: 2 },
      ]);

      const chapters = chapterRepo.findByProject(projectId);
      expect(chapters[0].id).toBe(c3.id);
      expect(chapters[1].id).toBe(c2.id);
      expect(chapters[2].id).toBe(c1.id);
    });

    it('updates volume_id during reorder', async () => {
      const projectId = seedProject();
      const volumeId = seedVolume(projectId);
      const c1 = await chapterRepo.create({ projectId, title: 'Ch1' });

      chapterRepo.reorder([{ id: c1.id, volumeId, sortOrder: 0 }]);

      const found = chapterRepo.findById(c1.id);
      expect(found!.volume_id).toBe(volumeId);
    });

    it('handles partial reorder', async () => {
      const projectId = seedProject();
      const c1 = await chapterRepo.create({ projectId, title: 'Ch1' });
      const c2 = await chapterRepo.create({ projectId, title: 'Ch2' });

      chapterRepo.reorder([{ id: c1.id, sortOrder: 5 }]);

      const found = chapterRepo.findById(c1.id);
      expect(found!.sort_order).toBe(5);
    });
  });

  describe('findScheduled', () => {
    it('returns chapters with publish_status scheduled', async () => {
      const projectId = seedProject();
      const c1 = await chapterRepo.create({ projectId, title: 'Draft Ch' });
      const c2 = await chapterRepo.create({ projectId, title: 'Scheduled Ch' });

      chapterRepo.update(c2.id, { publish_status: 'scheduled', scheduled_at: '2025-06-01T10:00:00Z' });

      const scheduled = chapterRepo.findScheduled(projectId);

      expect(scheduled).toHaveLength(1);
      expect(scheduled[0].id).toBe(c2.id);
    });

    it('returns empty array when no scheduled chapters', async () => {
      const projectId = seedProject();
      await chapterRepo.create({ projectId, title: 'Draft Ch' });

      expect(chapterRepo.findScheduled(projectId)).toEqual([]);
    });
  });

  describe('findByPublishStatus', () => {
    it('returns chapters matching the given publish_status', async () => {
      const projectId = seedProject();
      const c1 = await chapterRepo.create({ projectId, title: 'Ch1' });
      const c2 = await chapterRepo.create({ projectId, title: 'Ch2' });

      chapterRepo.update(c1.id, { publish_status: 'published' });
      chapterRepo.update(c2.id, { publish_status: 'published' });

      const published = chapterRepo.findByPublishStatus(projectId, 'published');

      expect(published).toHaveLength(2);
    });

    it('returns empty array for status with no matches', async () => {
      const projectId = seedProject();
      await chapterRepo.create({ projectId, title: 'Ch1' });

      expect(chapterRepo.findByPublishStatus(projectId, 'archived')).toEqual([]);
    });
  });
});
