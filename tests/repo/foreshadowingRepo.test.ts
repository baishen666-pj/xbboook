import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';

let memDb: Database.Database;

vi.mock('../../server/db/database.js', () => ({
  getDb: () => memDb,
}));

import * as foreshadowingRepo from '../../server/db/repositories/foreshadowingRepo.js';

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
      publish_status TEXT DEFAULT 'draft',
      scheduled_at TEXT,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (volume_id) REFERENCES volumes(id) ON DELETE SET NULL
    );
    CREATE TABLE foreshadowing (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      plant_chapter_id TEXT,
      expected_harvest_chapter_id TEXT,
      actual_harvest_chapter_id TEXT,
      status TEXT NOT NULL DEFAULT 'planted' CHECK(status IN ('planted','harvested','forgotten')),
      importance TEXT DEFAULT 'normal' CHECK(importance IN ('critical','important','normal','minor')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (plant_chapter_id) REFERENCES chapters(id) ON DELETE SET NULL,
      FOREIGN KEY (expected_harvest_chapter_id) REFERENCES chapters(id) ON DELETE SET NULL,
      FOREIGN KEY (actual_harvest_chapter_id) REFERENCES chapters(id) ON DELETE SET NULL
    );
  `);
}

function seedProject(): string {
  const id = randomUUID();
  memDb.prepare("INSERT INTO projects (id, name) VALUES (?, 'Test Novel')").run(id);
  return id;
}

function seedChapter(projectId: string): string {
  const id = randomUUID();
  const now = new Date().toISOString();
  memDb
    .prepare(
      `INSERT INTO chapters (id, project_id, title, file_path, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, 0, ?, ?)`,
    )
    .run(id, projectId, 'Chapter 1', `${projectId}/chapters/${id}.md`, now, now);
  return id;
}

describe('foreshadowingRepo', () => {
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
    it('creates a foreshadowing with minimal data', () => {
      const projectId = seedProject();

      const fs = foreshadowingRepo.create({ projectId, title: 'Mysterious Sword' });

      expect(fs).toBeDefined();
      expect(fs.id).toBeTruthy();
      expect(fs.title).toBe('Mysterious Sword');
      expect(fs.project_id).toBe(projectId);
      expect(fs.status).toBe('planted');
      expect(fs.importance).toBe('normal');
      expect(fs.description).toBeNull();
      expect(fs.plant_chapter_id).toBeNull();
      expect(fs.expected_harvest_chapter_id).toBeNull();
      expect(fs.actual_harvest_chapter_id).toBeNull();
    });

    it('creates a foreshadowing with all fields', () => {
      const projectId = seedProject();
      const chapterId = seedChapter(projectId);

      const fs = foreshadowingRepo.create({
        projectId,
        title: 'Hidden Power',
        description: 'The protagonist discovers a latent ability',
        plantChapterId: chapterId,
        expectedHarvestChapterId: chapterId,
        importance: 'critical',
      });

      expect(fs.title).toBe('Hidden Power');
      expect(fs.description).toBe('The protagonist discovers a latent ability');
      expect(fs.plant_chapter_id).toBe(chapterId);
      expect(fs.expected_harvest_chapter_id).toBe(chapterId);
      expect(fs.importance).toBe('critical');
    });

    it('sets default importance to normal', () => {
      const projectId = seedProject();

      const fs = foreshadowingRepo.create({ projectId, title: 'Clue' });

      expect(fs.importance).toBe('normal');
    });

    it('sets created_at and updated_at', () => {
      const projectId = seedProject();

      const fs = foreshadowingRepo.create({ projectId, title: 'Clue' });

      expect(fs.created_at).toBeTruthy();
      expect(fs.updated_at).toBeTruthy();
    });
  });

  describe('findAll', () => {
    it('returns foreshadowing for a project ordered by created_at', () => {
      const projectId = seedProject();

      foreshadowingRepo.create({ projectId, title: 'First' });
      foreshadowingRepo.create({ projectId, title: 'Second' });

      const all = foreshadowingRepo.findAll(projectId);

      expect(all).toHaveLength(2);
      expect(all[0].title).toBe('First');
      expect(all[1].title).toBe('Second');
    });

    it('returns empty array when no foreshadowing exists', () => {
      const projectId = seedProject();

      expect(foreshadowingRepo.findAll(projectId)).toEqual([]);
    });

    it('only returns foreshadowing for the specified project', () => {
      const p1 = seedProject();
      const p2 = seedProject();

      foreshadowingRepo.create({ projectId: p1, title: 'P1-Only' });
      foreshadowingRepo.create({ projectId: p2, title: 'P2-Only' });

      const results = foreshadowingRepo.findAll(p1);

      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('P1-Only');
    });
  });

  describe('findById', () => {
    it('returns foreshadowing by id', () => {
      const projectId = seedProject();
      const created = foreshadowingRepo.create({ projectId, title: 'Find Me' });

      const found = foreshadowingRepo.findById(created.id);

      expect(found).toBeDefined();
      expect(found!.title).toBe('Find Me');
    });

    it('returns undefined for non-existent id', () => {
      expect(foreshadowingRepo.findById('non-existent')).toBeUndefined();
    });
  });

  describe('findByChapter', () => {
    it('returns foreshadowing planted in a chapter', () => {
      const projectId = seedProject();
      const chapterId = seedChapter(projectId);

      foreshadowingRepo.create({ projectId, title: 'Planted Here', plantChapterId: chapterId });

      const results = foreshadowingRepo.findByChapter(chapterId);

      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Planted Here');
    });

    it('returns foreshadowing expected to harvest in a chapter', () => {
      const projectId = seedProject();
      const chapterId = seedChapter(projectId);

      foreshadowingRepo.create({ projectId, title: 'Expected Harvest', expectedHarvestChapterId: chapterId });

      const results = foreshadowingRepo.findByChapter(chapterId);

      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Expected Harvest');
    });

    it('returns foreshadowing actually harvested in a chapter', () => {
      const projectId = seedProject();
      const chapterId = seedChapter(projectId);
      const created = foreshadowingRepo.create({ projectId, title: 'Actual Harvest' });

      foreshadowingRepo.update(created.id, { actual_harvest_chapter_id: chapterId });

      const results = foreshadowingRepo.findByChapter(chapterId);

      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Actual Harvest');
    });

    it('returns empty array when chapter has no foreshadowing', () => {
      const chapterId = randomUUID();

      expect(foreshadowingRepo.findByChapter(chapterId)).toEqual([]);
    });
  });

  describe('findByStatus', () => {
    it('returns foreshadowing with the specified status', () => {
      const projectId = seedProject();

      foreshadowingRepo.create({ projectId, title: 'Planted One' });
      const fs2 = foreshadowingRepo.create({ projectId, title: 'Harvested One' });
      foreshadowingRepo.updateStatus(fs2.id, 'harvested');

      const planted = foreshadowingRepo.findByStatus(projectId, 'planted');
      const harvested = foreshadowingRepo.findByStatus(projectId, 'harvested');

      expect(planted).toHaveLength(1);
      expect(planted[0].title).toBe('Planted One');
      expect(harvested).toHaveLength(1);
      expect(harvested[0].title).toBe('Harvested One');
    });

    it('returns empty array for status with no matches', () => {
      const projectId = seedProject();

      expect(foreshadowingRepo.findByStatus(projectId, 'forgotten')).toEqual([]);
    });
  });

  describe('update', () => {
    it('updates title', () => {
      const projectId = seedProject();
      const created = foreshadowingRepo.create({ projectId, title: 'Original' });

      const updated = foreshadowingRepo.update(created.id, { title: 'Updated Title' });

      expect(updated!.title).toBe('Updated Title');
    });

    it('updates description', () => {
      const projectId = seedProject();
      const created = foreshadowingRepo.create({ projectId, title: 'Clue' });

      const updated = foreshadowingRepo.update(created.id, { description: 'New details' });

      expect(updated!.description).toBe('New details');
    });

    it('updates status', () => {
      const projectId = seedProject();
      const created = foreshadowingRepo.create({ projectId, title: 'Clue' });

      const updated = foreshadowingRepo.update(created.id, { status: 'harvested' });

      expect(updated!.status).toBe('harvested');
    });

    it('updates importance', () => {
      const projectId = seedProject();
      const created = foreshadowingRepo.create({ projectId, title: 'Clue' });

      const updated = foreshadowingRepo.update(created.id, { importance: 'critical' });

      expect(updated!.importance).toBe('critical');
    });

    it('updates plant_chapter_id', () => {
      const projectId = seedProject();
      const chapterId = seedChapter(projectId);
      const created = foreshadowingRepo.create({ projectId, title: 'Clue' });

      const updated = foreshadowingRepo.update(created.id, { plant_chapter_id: chapterId });

      expect(updated!.plant_chapter_id).toBe(chapterId);
    });

    it('updates multiple fields at once', () => {
      const projectId = seedProject();
      const created = foreshadowingRepo.create({ projectId, title: 'Original' });

      const updated = foreshadowingRepo.update(created.id, {
        title: 'New Title',
        description: 'New Desc',
        importance: 'important',
      });

      expect(updated!.title).toBe('New Title');
      expect(updated!.description).toBe('New Desc');
      expect(updated!.importance).toBe('important');
    });

    it('returns undefined for non-existent foreshadowing', () => {
      expect(foreshadowingRepo.update('non-existent', { title: 'X' })).toBeUndefined();
    });

    it('returns existing foreshadowing when no valid fields provided', () => {
      const projectId = seedProject();
      const created = foreshadowingRepo.create({ projectId, title: 'Same' });

      const result = foreshadowingRepo.update(created.id, { unknown_field: 'ignored' } as Record<string, unknown>);

      expect(result).toBeDefined();
      expect(result!.title).toBe('Same');
    });

    it('updates updated_at timestamp', () => {
      const projectId = seedProject();
      const created = foreshadowingRepo.create({ projectId, title: 'Clue' });
      const originalUpdatedAt = created.updated_at;

      const updated = foreshadowingRepo.update(created.id, { title: 'Clue-Updated' });

      expect(updated!.updated_at).not.toBe(originalUpdatedAt);
    });
  });

  describe('updateStatus', () => {
    it('updates status via updateStatus helper', () => {
      const projectId = seedProject();
      const created = foreshadowingRepo.create({ projectId, title: 'Clue' });

      const updated = foreshadowingRepo.updateStatus(created.id, 'harvested');

      expect(updated!.status).toBe('harvested');
    });

    it('returns undefined for non-existent foreshadowing', () => {
      expect(foreshadowingRepo.updateStatus('non-existent', 'harvested')).toBeUndefined();
    });
  });

  describe('deleteById', () => {
    it('deletes a foreshadowing and returns true', () => {
      const projectId = seedProject();
      const created = foreshadowingRepo.create({ projectId, title: 'Delete Me' });

      expect(foreshadowingRepo.deleteById(created.id)).toBe(true);
      expect(foreshadowingRepo.findById(created.id)).toBeUndefined();
    });

    it('returns false for non-existent foreshadowing', () => {
      expect(foreshadowingRepo.deleteById('non-existent')).toBe(false);
    });

    it('does not affect other foreshadowing entries', () => {
      const projectId = seedProject();
      const f1 = foreshadowingRepo.create({ projectId, title: 'Keep' });
      const f2 = foreshadowingRepo.create({ projectId, title: 'Delete' });

      foreshadowingRepo.deleteById(f2.id);

      const remaining = foreshadowingRepo.findAll(projectId);
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe(f1.id);
    });
  });
});
