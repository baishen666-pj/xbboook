import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';

let memDb: Database.Database;

vi.mock('../../server/db/database.js', () => ({
  getDb: () => memDb,
}));

import * as volumeRepo from '../../server/db/repositories/volumeRepo.js';

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
  `);
}

function seedProject(): string {
  const id = randomUUID();
  memDb.prepare("INSERT INTO projects (id, name) VALUES (?, 'Test Novel')").run(id);
  return id;
}

describe('volumeRepo', () => {
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
    it('creates a volume with minimal data', () => {
      const projectId = seedProject();

      const vol = volumeRepo.create({ projectId, title: 'Volume 1' });

      expect(vol).toBeDefined();
      expect(vol.id).toBeTruthy();
      expect(vol.title).toBe('Volume 1');
      expect(vol.summary).toBeNull();
      expect(vol.sort_order).toBe(0);
    });

    it('creates a volume with summary', () => {
      const projectId = seedProject();

      const vol = volumeRepo.create({ projectId, title: 'Volume 2', summary: 'The hero rises' });

      expect(vol.summary).toBe('The hero rises');
    });

    it('auto-increments sort_order per project', () => {
      const projectId = seedProject();

      const v1 = volumeRepo.create({ projectId, title: 'V1' });
      const v2 = volumeRepo.create({ projectId, title: 'V2' });
      const v3 = volumeRepo.create({ projectId, title: 'V3' });

      expect(v1.sort_order).toBe(0);
      expect(v2.sort_order).toBe(1);
      expect(v3.sort_order).toBe(2);
    });

    it('sort_order is independent per project', () => {
      const p1 = seedProject();
      const p2 = seedProject();

      const v1 = volumeRepo.create({ projectId: p1, title: 'P1-V1' });
      const v2 = volumeRepo.create({ projectId: p2, title: 'P2-V1' });

      expect(v1.sort_order).toBe(0);
      expect(v2.sort_order).toBe(0);
    });
  });

  describe('findByProject', () => {
    it('returns volumes ordered by sort_order', () => {
      const projectId = seedProject();

      volumeRepo.create({ projectId, title: 'Third' });
      volumeRepo.create({ projectId, title: 'First' });
      volumeRepo.create({ projectId, title: 'Second' });

      // Reorder so we can verify ordering
      const volumes = volumeRepo.findByProject(projectId);

      expect(volumes).toHaveLength(3);
      expect(volumes[0].sort_order).toBeLessThan(volumes[1].sort_order);
    });

    it('returns empty array when no volumes exist', () => {
      const projectId = seedProject();
      expect(volumeRepo.findByProject(projectId)).toEqual([]);
    });

    it('only returns volumes for the specified project', () => {
      const p1 = seedProject();
      const p2 = seedProject();

      volumeRepo.create({ projectId: p1, title: 'P1-Only' });
      volumeRepo.create({ projectId: p2, title: 'P2-Only' });

      expect(volumeRepo.findByProject(p1)).toHaveLength(1);
      expect(volumeRepo.findByProject(p1)[0].title).toBe('P1-Only');
    });
  });

  describe('findById', () => {
    it('returns volume by id', () => {
      const projectId = seedProject();
      const created = volumeRepo.create({ projectId, title: 'Find Me' });

      const found = volumeRepo.findById(created.id);

      expect(found).toBeDefined();
      expect(found!.title).toBe('Find Me');
    });

    it('returns undefined for non-existent id', () => {
      expect(volumeRepo.findById('non-existent')).toBeUndefined();
    });
  });

  describe('update', () => {
    it('updates title', () => {
      const projectId = seedProject();
      const created = volumeRepo.create({ projectId, title: 'Original' });

      const updated = volumeRepo.update(created.id, { title: 'Updated Title' });

      expect(updated!.title).toBe('Updated Title');
    });

    it('updates summary', () => {
      const projectId = seedProject();
      const created = volumeRepo.create({ projectId, title: 'V1' });

      const updated = volumeRepo.update(created.id, { summary: 'New summary text' });

      expect(updated!.summary).toBe('New summary text');
    });

    it('updates sort_order', () => {
      const projectId = seedProject();
      const created = volumeRepo.create({ projectId, title: 'V1' });

      const updated = volumeRepo.update(created.id, { sort_order: 5 });

      expect(updated!.sort_order).toBe(5);
    });

    it('updates multiple fields at once', () => {
      const projectId = seedProject();
      const created = volumeRepo.create({ projectId, title: 'Original' });

      const updated = volumeRepo.update(created.id, { title: 'New', summary: 'Desc', sort_order: 3 });

      expect(updated!.title).toBe('New');
      expect(updated!.summary).toBe('Desc');
      expect(updated!.sort_order).toBe(3);
    });

    it('returns undefined for non-existent volume', () => {
      expect(volumeRepo.update('non-existent', { title: 'X' })).toBeUndefined();
    });

    it('returns existing volume when no valid fields provided', () => {
      const projectId = seedProject();
      const created = volumeRepo.create({ projectId, title: 'Same' });

      const result = volumeRepo.update(created.id, { unknown_field: 'ignored' } as Record<string, unknown>);

      expect(result).toBeDefined();
      expect(result!.title).toBe('Same');
    });
  });

  describe('deleteById', () => {
    it('deletes a volume and returns true', () => {
      const projectId = seedProject();
      const created = volumeRepo.create({ projectId, title: 'Delete Me' });

      expect(volumeRepo.deleteById(created.id)).toBe(true);
      expect(volumeRepo.findById(created.id)).toBeUndefined();
    });

    it('returns false for non-existent volume', () => {
      expect(volumeRepo.deleteById('non-existent')).toBe(false);
    });

    it('does not affect other volumes', () => {
      const projectId = seedProject();
      const v1 = volumeRepo.create({ projectId, title: 'Keep' });
      const v2 = volumeRepo.create({ projectId, title: 'Delete' });

      volumeRepo.deleteById(v2.id);

      const remaining = volumeRepo.findByProject(projectId);
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe(v1.id);
    });
  });

  describe('reorder', () => {
    it('updates sort_order for multiple volumes in a transaction', () => {
      const projectId = seedProject();
      const v1 = volumeRepo.create({ projectId, title: 'V1' });
      const v2 = volumeRepo.create({ projectId, title: 'V2' });
      const v3 = volumeRepo.create({ projectId, title: 'V3' });

      // Reverse the order
      volumeRepo.reorder([
        { id: v3.id, sortOrder: 0 },
        { id: v2.id, sortOrder: 1 },
        { id: v1.id, sortOrder: 2 },
      ]);

      const volumes = volumeRepo.findByProject(projectId);
      expect(volumes[0].id).toBe(v3.id);
      expect(volumes[1].id).toBe(v2.id);
      expect(volumes[2].id).toBe(v1.id);
    });

    it('handles partial reorder', () => {
      const projectId = seedProject();
      const v1 = volumeRepo.create({ projectId, title: 'V1' });
      const v2 = volumeRepo.create({ projectId, title: 'V2' });

      volumeRepo.reorder([{ id: v1.id, sortOrder: 5 }]);

      const found = volumeRepo.findById(v1.id);
      expect(found!.sort_order).toBe(5);
    });
  });
});
