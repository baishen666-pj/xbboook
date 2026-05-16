import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';

let memDb: Database.Database;

vi.mock('../../server/db/database.js', () => ({
  getDb: () => memDb,
}));

import * as worldviewRepo from '../../server/db/repositories/worldviewRepo.js';

function setupTables(): void {
  memDb.exec(`
    CREATE TABLE projects (
      id TEXT PRIMARY KEY, name TEXT NOT NULL,
      status TEXT DEFAULT 'active', sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE worldviews (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, category TEXT NOT NULL,
      title TEXT NOT NULL, content TEXT, sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
  `);
}

function seedProject(): string {
  const id = randomUUID();
  memDb.prepare("INSERT INTO projects (id, name) VALUES (?, 'Test Novel')").run(id);
  return id;
}

describe('worldviewRepo', () => {
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
    it('creates a worldview entry', () => {
      const projectId = seedProject();

      const wv = worldviewRepo.create({ projectId, category: 'geography', title: 'The Eastern Continent' });

      expect(wv).toBeDefined();
      expect(wv.id).toBeTruthy();
      expect(wv.category).toBe('geography');
      expect(wv.title).toBe('The Eastern Continent');
      expect(wv.content).toBeNull();
      expect(wv.sort_order).toBe(0);
    });

    it('creates a worldview with content', () => {
      const projectId = seedProject();

      const wv = worldviewRepo.create({
        projectId,
        category: 'magic',
        title: 'Elemental System',
        content: 'Fire, Water, Earth, Wind',
      });

      expect(wv.content).toBe('Fire, Water, Earth, Wind');
    });

    it('auto-increments sort_order', () => {
      const projectId = seedProject();

      const wv1 = worldviewRepo.create({ projectId, category: 'a', title: 'First' });
      const wv2 = worldviewRepo.create({ projectId, category: 'b', title: 'Second' });

      expect(wv1.sort_order).toBe(0);
      expect(wv2.sort_order).toBe(1);
    });
  });

  describe('findByProject', () => {
    it('returns worldviews ordered by category and sort_order', () => {
      const projectId = seedProject();

      worldviewRepo.create({ projectId, category: 'magic', title: 'A' });
      worldviewRepo.create({ projectId, category: 'geography', title: 'B' });
      worldviewRepo.create({ projectId, category: 'magic', title: 'C' });

      const wvs = worldviewRepo.findByProject(projectId);

      expect(wvs).toHaveLength(3);
      expect(wvs[0].category).toBe('geography');
      expect(wvs[1].category).toBe('magic');
    });

    it('returns empty array when no worldviews exist', () => {
      const projectId = seedProject();
      expect(worldviewRepo.findByProject(projectId)).toEqual([]);
    });
  });

  describe('findByCategory', () => {
    it('returns worldviews for a specific category', () => {
      const projectId = seedProject();

      worldviewRepo.create({ projectId, category: 'magic', title: 'Spell System' });
      worldviewRepo.create({ projectId, category: 'geography', title: 'Map' });
      worldviewRepo.create({ projectId, category: 'magic', title: 'Mana Types' });

      const magicItems = worldviewRepo.findByCategory(projectId, 'magic');

      expect(magicItems).toHaveLength(2);
      magicItems.forEach(wv => expect(wv.category).toBe('magic'));
    });

    it('returns empty array for unknown category', () => {
      const projectId = seedProject();
      worldviewRepo.create({ projectId, category: 'magic', title: 'A' });

      expect(worldviewRepo.findByCategory(projectId, 'history')).toEqual([]);
    });
  });

  describe('findById', () => {
    it('returns worldview by id', () => {
      const projectId = seedProject();
      const created = worldviewRepo.create({ projectId, category: 'test', title: 'Find Me' });

      const found = worldviewRepo.findById(created.id);

      expect(found).toBeDefined();
      expect(found!.title).toBe('Find Me');
    });

    it('returns undefined for non-existent id', () => {
      expect(worldviewRepo.findById('non-existent')).toBeUndefined();
    });
  });

  describe('getCategories', () => {
    it('returns distinct categories ordered alphabetically', () => {
      const projectId = seedProject();

      worldviewRepo.create({ projectId, category: 'magic', title: 'A' });
      worldviewRepo.create({ projectId, category: 'geography', title: 'B' });
      worldviewRepo.create({ projectId, category: 'magic', title: 'C' });
      worldviewRepo.create({ projectId, category: 'history', title: 'D' });

      const cats = worldviewRepo.getCategories(projectId);

      expect(cats).toEqual(['geography', 'history', 'magic']);
    });

    it('returns empty array when no worldviews exist', () => {
      const projectId = seedProject();
      expect(worldviewRepo.getCategories(projectId)).toEqual([]);
    });
  });

  describe('update', () => {
    it('updates title and content', () => {
      const projectId = seedProject();
      const created = worldviewRepo.create({ projectId, category: 'magic', title: 'Original' });

      const updated = worldviewRepo.update(created.id, { title: 'Updated Title', content: 'New content' });

      expect(updated!.title).toBe('Updated Title');
      expect(updated!.content).toBe('New content');
    });

    it('updates category', () => {
      const projectId = seedProject();
      const created = worldviewRepo.create({ projectId, category: 'old', title: 'Test' });

      const updated = worldviewRepo.update(created.id, { category: 'new' });

      expect(updated!.category).toBe('new');
    });

    it('updates sort_order', () => {
      const projectId = seedProject();
      const created = worldviewRepo.create({ projectId, category: 'test', title: 'Test' });

      const updated = worldviewRepo.update(created.id, { sort_order: 10 });

      expect(updated!.sort_order).toBe(10);
    });

    it('returns undefined for non-existent worldview', () => {
      expect(worldviewRepo.update('non-existent', { title: 'X' })).toBeUndefined();
    });

    it('returns existing worldview when no valid fields provided', () => {
      const projectId = seedProject();
      const created = worldviewRepo.create({ projectId, category: 'test', title: 'Same' });

      const result = worldviewRepo.update(created.id, { unknown: 'ignored' } as Record<string, unknown>);

      expect(result).toBeDefined();
      expect(result!.title).toBe('Same');
    });
  });

  describe('deleteById', () => {
    it('deletes a worldview and returns true', () => {
      const projectId = seedProject();
      const created = worldviewRepo.create({ projectId, category: 'test', title: 'Delete Me' });

      expect(worldviewRepo.deleteById(created.id)).toBe(true);
      expect(worldviewRepo.findById(created.id)).toBeUndefined();
    });

    it('returns false for non-existent worldview', () => {
      expect(worldviewRepo.deleteById('non-existent')).toBe(false);
    });

    it('does not affect other worldviews', () => {
      const projectId = seedProject();
      const wv1 = worldviewRepo.create({ projectId, category: 'a', title: 'Keep' });
      const wv2 = worldviewRepo.create({ projectId, category: 'b', title: 'Delete' });

      worldviewRepo.deleteById(wv2.id);

      expect(worldviewRepo.findByProject(projectId)).toHaveLength(1);
      expect(worldviewRepo.findById(wv1.id)).toBeDefined();
    });
  });
});
