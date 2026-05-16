import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';

let memDb: Database.Database;

vi.mock('../../server/db/database.js', () => ({
  getDb: () => memDb,
}));

import * as outlineRepo from '../../server/db/repositories/outlineRepo.js';

function setupTables(): void {
  memDb.exec(`
    CREATE TABLE projects (
      id TEXT PRIMARY KEY, name TEXT NOT NULL,
      status TEXT DEFAULT 'active', sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE outlines (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL,
      level INTEGER DEFAULT 0, parent_id TEXT, target_ref_id TEXT,
      title TEXT NOT NULL, content TEXT, sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (parent_id) REFERENCES outlines(id) ON DELETE CASCADE
    );
  `);
}

function seedProject(): string {
  const id = randomUUID();
  memDb.prepare("INSERT INTO projects (id, name) VALUES (?, 'Test Novel')").run(id);
  return id;
}

describe('outlineRepo', () => {
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
    it('creates a top-level outline item', () => {
      const projectId = seedProject();

      const outline = outlineRepo.create({ projectId, title: 'Act 1: The Beginning' });

      expect(outline).toBeDefined();
      expect(outline.id).toBeTruthy();
      expect(outline.title).toBe('Act 1: The Beginning');
      expect(outline.level).toBe(0);
      expect(outline.parent_id).toBeNull();
      expect(outline.content).toBeNull();
      expect(outline.sort_order).toBe(0);
    });

    it('creates a child outline with parent reference', () => {
      const projectId = seedProject();
      const parent = outlineRepo.create({ projectId, title: 'Act 1', level: 0 });

      const child = outlineRepo.create({
        projectId,
        title: 'Chapter 1',
        parentId: parent.id,
        level: 1,
        content: 'Opening scene description',
      });

      expect(child.parent_id).toBe(parent.id);
      expect(child.level).toBe(1);
      expect(child.content).toBe('Opening scene description');
    });

    it('creates with targetRefId', () => {
      const projectId = seedProject();

      const outline = outlineRepo.create({ projectId, title: 'Outline A', targetRefId: 'ref-123' });

      expect(outline.target_ref_id).toBe('ref-123');
    });

    it('auto-increments sort_order per project', () => {
      const projectId = seedProject();

      const o1 = outlineRepo.create({ projectId, title: 'First' });
      const o2 = outlineRepo.create({ projectId, title: 'Second' });

      expect(o1.sort_order).toBe(0);
      expect(o2.sort_order).toBe(1);
    });
  });

  describe('findByProject', () => {
    it('returns outlines ordered by level and sort_order', () => {
      const projectId = seedProject();

      outlineRepo.create({ projectId, title: 'B-Level0', level: 0 });
      outlineRepo.create({ projectId, title: 'A-Level1', level: 1 });
      outlineRepo.create({ projectId, title: 'A-Level0', level: 0 });

      const outlines = outlineRepo.findByProject(projectId);

      expect(outlines).toHaveLength(3);
      expect(outlines[0].level).toBe(0);
      expect(outlines[1].level).toBe(0);
      expect(outlines[2].level).toBe(1);
    });

    it('returns empty array for project with no outlines', () => {
      const projectId = seedProject();
      expect(outlineRepo.findByProject(projectId)).toEqual([]);
    });
  });

  describe('findByLevel', () => {
    it('returns outlines at a specific level', () => {
      const projectId = seedProject();

      outlineRepo.create({ projectId, title: 'L0-A', level: 0 });
      outlineRepo.create({ projectId, title: 'L1-A', level: 1 });
      outlineRepo.create({ projectId, title: 'L0-B', level: 0 });

      const level0 = outlineRepo.findByLevel(projectId, 0);

      expect(level0).toHaveLength(2);
      level0.forEach(o => expect(o.level).toBe(0));
    });
  });

  describe('findChildren', () => {
    it('returns children of a parent outline', () => {
      const projectId = seedProject();
      const parent = outlineRepo.create({ projectId, title: 'Parent', level: 0 });

      outlineRepo.create({ projectId, title: 'Child 1', parentId: parent.id, level: 1 });
      outlineRepo.create({ projectId, title: 'Child 2', parentId: parent.id, level: 1 });
      outlineRepo.create({ projectId, title: 'Other', level: 0 });

      const children = outlineRepo.findChildren(projectId, parent.id);

      expect(children).toHaveLength(2);
      children.forEach(c => expect(c.parent_id).toBe(parent.id));
    });

    it('returns empty array when parent has no children', () => {
      const projectId = seedProject();
      const parent = outlineRepo.create({ projectId, title: 'No Children' });

      expect(outlineRepo.findChildren(projectId, parent.id)).toEqual([]);
    });
  });

  describe('findById', () => {
    it('returns outline by id', () => {
      const projectId = seedProject();
      const created = outlineRepo.create({ projectId, title: 'Find Me' });

      const found = outlineRepo.findById(created.id);

      expect(found).toBeDefined();
      expect(found!.title).toBe('Find Me');
    });

    it('returns undefined for non-existent id', () => {
      expect(outlineRepo.findById('non-existent')).toBeUndefined();
    });
  });

  describe('update', () => {
    it('updates title and content', () => {
      const projectId = seedProject();
      const created = outlineRepo.create({ projectId, title: 'Original' });

      const updated = outlineRepo.update(created.id, { title: 'Updated Title', content: 'New content' });

      expect(updated).toBeDefined();
      expect(updated!.title).toBe('Updated Title');
      expect(updated!.content).toBe('New content');
    });

    it('updates level and sort_order', () => {
      const projectId = seedProject();
      const created = outlineRepo.create({ projectId, title: 'Test' });

      const updated = outlineRepo.update(created.id, { level: 2, sort_order: 5 });

      expect(updated!.level).toBe(2);
      expect(updated!.sort_order).toBe(5);
    });

    it('returns undefined for non-existent outline', () => {
      expect(outlineRepo.update('non-existent', { title: 'X' })).toBeUndefined();
    });

    it('returns existing outline when no valid fields provided', () => {
      const projectId = seedProject();
      const created = outlineRepo.create({ projectId, title: 'Same' });

      const result = outlineRepo.update(created.id, { unknown_field: 'ignored' } as Record<string, unknown>);

      expect(result).toBeDefined();
      expect(result!.title).toBe('Same');
    });
  });

  describe('deleteById', () => {
    it('deletes an outline and returns true', () => {
      const projectId = seedProject();
      const created = outlineRepo.create({ projectId, title: 'Delete Me' });

      expect(outlineRepo.deleteById(created.id)).toBe(true);
      expect(outlineRepo.findById(created.id)).toBeUndefined();
    });

    it('reassigns children to grandparent when deleting parent', () => {
      const projectId = seedProject();
      const grandparent = outlineRepo.create({ projectId, title: 'GP', level: 0 });
      const parent = outlineRepo.create({ projectId, title: 'P', level: 1, parentId: grandparent.id });
      const child = outlineRepo.create({ projectId, title: 'C', level: 2, parentId: parent.id });

      outlineRepo.deleteById(parent.id);

      const orphanedChild = outlineRepo.findById(child.id);
      expect(orphanedChild).toBeDefined();
      expect(orphanedChild!.parent_id).toBe(grandparent.id);
    });

    it('reassigns children to null when deleting root-level parent', () => {
      const projectId = seedProject();
      const parent = outlineRepo.create({ projectId, title: 'Root', level: 0 });
      const child = outlineRepo.create({ projectId, title: 'Child', level: 1, parentId: parent.id });

      outlineRepo.deleteById(parent.id);

      const orphanedChild = outlineRepo.findById(child.id);
      expect(orphanedChild).toBeDefined();
      expect(orphanedChild!.parent_id).toBeNull();
    });

    it('returns false for non-existent outline', () => {
      expect(outlineRepo.deleteById('non-existent')).toBe(false);
    });
  });
});
