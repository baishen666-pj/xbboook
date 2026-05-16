import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';

let testDb: Database.Database;

vi.mock('../../server/db/database.js', () => ({
  getDb: () => testDb,
  closeDb: () => {},
}));

vi.mock('../../server/db/seedTemplates.js', () => ({
  BUILTIN_TEMPLATES: [],
}));

import * as templateRepo from '../../server/db/repositories/templateRepo.js';
import * as outlineRepo from '../../server/db/repositories/outlineRepo.js';
import * as templateService from '../../server/services/templateService.js';

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
    CREATE TABLE outlines (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, level INTEGER DEFAULT 0,
      parent_id TEXT, target_ref_id TEXT, title TEXT NOT NULL, content TEXT,
      sort_order INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (parent_id) REFERENCES outlines(id) ON DELETE CASCADE
    );
    CREATE TABLE outline_templates (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, genre TEXT NOT NULL, description TEXT,
      is_builtin INTEGER DEFAULT 0, source_project_id TEXT, structure TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
    );
  `);
  return db;
}

describe('templateService', () => {
  beforeEach(() => {
    testDb = createTestDb();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (testDb) testDb.close();
  });

  function seedProject(id = 'proj-1') {
    testDb.prepare(
      `INSERT INTO projects (id, name, genre, writing_mode, sort_order, created_at, updated_at) VALUES (?, ?, 'fantasy', 'webnovel', 0, datetime('now'), datetime('now'))`,
    ).run(id, 'Test');
  }

  function seedTemplate(overrides: { name: string; genre: string; structure?: string }) {
    return templateRepo.create({
      name: overrides.name,
      genre: overrides.genre,
      structure: overrides.structure ?? JSON.stringify([{ title: 'Act 1', level: 0 }]),
    });
  }

  describe('listTemplates', () => {
    it('returns all templates when no genre given', () => {
      seedTemplate({ name: 'T1', genre: 'fantasy' });
      seedTemplate({ name: 'T2', genre: 'scifi' });
      const result = templateService.listTemplates();
      expect(result).toHaveLength(2);
    });

    it('filters by genre', () => {
      seedTemplate({ name: 'T1', genre: 'fantasy' });
      seedTemplate({ name: 'T2', genre: 'scifi' });
      const result = templateService.listTemplates('fantasy');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('T1');
    });
  });

  describe('getTemplate', () => {
    it('returns template by id', () => {
      const t = seedTemplate({ name: 'My Template', genre: 'fantasy' });
      const result = templateService.getTemplate(t.id);
      expect(result).toBeDefined();
      expect(result!.name).toBe('My Template');
    });

    it('returns undefined for non-existent id', () => {
      expect(templateService.getTemplate('nonexistent')).toBeUndefined();
    });
  });

  describe('applyTemplate', () => {
    it('creates outlines in append mode', () => {
      seedProject();
      const t = seedTemplate({
        name: 'Plot',
        genre: 'fantasy',
        structure: JSON.stringify([
          { title: 'Act 1', level: 0 },
          { title: 'Scene 1', level: 1 },
        ]),
      });

      const outlines = templateService.applyTemplate(t.id, 'proj-1', 'append');
      expect(outlines).toHaveLength(2);
      expect(outlines[0].title).toBe('Act 1');
      expect(outlines[1].title).toBe('Scene 1');
    });

    it('replaces existing outlines in replace mode', () => {
      seedProject();
      // Seed an existing outline
      outlineRepo.create({ projectId: 'proj-1', level: 0, title: 'Old Outline' });

      const t = seedTemplate({
        name: 'New',
        genre: 'fantasy',
        structure: JSON.stringify([{ title: 'New Outline', level: 0 }]),
      });

      const outlines = templateService.applyTemplate(t.id, 'proj-1', 'replace');
      expect(outlines).toHaveLength(1);
      expect(outlines[0].title).toBe('New Outline');
    });

    it('throws for non-existent template', () => {
      seedProject();
      expect(() => templateService.applyTemplate('nonexistent', 'proj-1')).toThrow('模板不存在');
    });
  });

  describe('createFromProject', () => {
    it('creates template from project outlines', () => {
      seedProject();
      outlineRepo.create({ projectId: 'proj-1', level: 0, title: 'Act 1', content: 'Setup' });

      const t = templateService.createFromProject('proj-1', 'Saved', 'fantasy', 'From project');
      expect(t.name).toBe('Saved');
      expect(t.source_project_id).toBe('proj-1');
    });

    it('throws when project has no outlines', () => {
      seedProject();
      expect(() => templateService.createFromProject('proj-1', 'Empty', 'fantasy')).toThrow('暂无大纲');
    });
  });

  describe('deleteTemplate', () => {
    it('deletes user template', () => {
      const t = seedTemplate({ name: 'Deletable', genre: 'fantasy' });
      expect(templateService.deleteTemplate(t.id)).toBe(true);
    });

    it('refuses to delete builtin template', () => {
      const t = templateRepo.create({
        name: 'Builtin',
        genre: 'fantasy',
        isBuiltin: 1,
        structure: '[]',
      });
      expect(templateService.deleteTemplate(t.id)).toBe(false);
    });
  });
});
