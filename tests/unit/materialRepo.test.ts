import { describe, it, expect, vi, beforeEach } from 'vitest';
import Database from 'better-sqlite3';

let memDb: Database.Database;

vi.mock('../../server/db/database.js', () => ({
  getDb: () => memDb,
}));

import * as materialRepo from '../../server/db/repositories/materialRepo.js';

function setupTables(): void {
  memDb.exec(`
    CREATE TABLE projects (
      id TEXT PRIMARY KEY, name TEXT NOT NULL,
      status TEXT DEFAULT 'active', sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE material_box (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT 'other',
      tags TEXT NOT NULL DEFAULT '[]',
      source TEXT,
      metadata TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
    CREATE INDEX idx_material_box_project ON material_box(project_id);
    CREATE INDEX idx_material_box_category ON material_box(project_id, category);
  `);
}

const PROJECT_ID = 'test-proj-1';

describe('materialRepo', () => {
  beforeEach(() => {
    memDb = new Database(':memory:');
    setupTables();
    memDb.prepare("INSERT INTO projects (id, name) VALUES (?, ?)").run(PROJECT_ID, 'Test');
  });

  it('should create and find a material', () => {
    const material = materialRepo.create({
      project_id: PROJECT_ID,
      title: 'Test Material',
      content: 'Test content',
      category: 'plot',
      tags: ['test'],
    });

    expect(material.id).toBeDefined();
    expect(material.title).toBe('Test Material');
    expect(material.category).toBe('plot');

    const found = materialRepo.findById(material.id);
    expect(found).toBeDefined();
    expect(found!.title).toBe('Test Material');
  });

  it('should list materials by project', () => {
    materialRepo.create({ project_id: PROJECT_ID, title: 'M1', content: 'C1', category: 'character' });
    materialRepo.create({ project_id: PROJECT_ID, title: 'M2', content: 'C2', category: 'plot' });
    materialRepo.create({ project_id: PROJECT_ID, title: 'M3', content: 'C3', category: 'character' });

    const all = materialRepo.findByProject(PROJECT_ID);
    expect(all).toHaveLength(3);

    const chars = materialRepo.findByProject(PROJECT_ID, 'character');
    expect(chars).toHaveLength(2);
  });

  it('should search materials', () => {
    materialRepo.create({ project_id: PROJECT_ID, title: 'Hero Character', content: 'Brave warrior', category: 'character' });
    materialRepo.create({ project_id: PROJECT_ID, title: 'Villain Plot', content: 'Dark scheme', category: 'plot' });

    const results = materialRepo.search(PROJECT_ID, 'Hero');
    expect(results).toHaveLength(1);
    expect(results[0]!.title).toBe('Hero Character');
  });

  it('should update a material', () => {
    const m = materialRepo.create({ project_id: PROJECT_ID, title: 'Old', content: 'Old', category: 'other' });
    const updated = materialRepo.update(m.id, { title: 'New', category: 'plot' });

    expect(updated!.title).toBe('New');
    expect(updated!.category).toBe('plot');
  });

  it('should delete a material', () => {
    const m = materialRepo.create({ project_id: PROJECT_ID, title: 'Delete', content: 'Bye', category: 'other' });
    expect(materialRepo.remove(m.id)).toBe(true);
    expect(materialRepo.findById(m.id)).toBeUndefined();
  });

  it('should count by category', () => {
    materialRepo.create({ project_id: PROJECT_ID, title: 'A', content: 'C', category: 'character' });
    materialRepo.create({ project_id: PROJECT_ID, title: 'B', content: 'C', category: 'character' });
    materialRepo.create({ project_id: PROJECT_ID, title: 'C', content: 'C', category: 'plot' });

    const stats = materialRepo.countByCategory(PROJECT_ID);
    expect(stats.find(s => s.category === 'character')?.count).toBe(2);
    expect(stats.find(s => s.category === 'plot')?.count).toBe(1);
  });
});
