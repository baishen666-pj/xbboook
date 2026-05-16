import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';

let memDb: Database.Database;

vi.mock('../../server/db/database.js', () => ({
  getDb: () => memDb,
}));

// Mock BUILTIN_TEMPLATES to avoid dependency on the real module
vi.mock('../../server/db/seedTemplates.js', () => ({
  BUILTIN_TEMPLATES: [
    {
      name: 'Test Template',
      genre: 'fantasy',
      description: 'A test template',
      structure: [{ title: 'Act 1', level: 0 }, { title: 'Chapter 1', level: 1 }],
    },
    {
      name: 'Test Template 2',
      genre: 'scifi',
      description: 'Another test',
      structure: [{ title: 'Part 1', level: 0 }],
    },
  ],
}));

import * as templateRepo from '../../server/db/repositories/templateRepo.js';

function setupTables(): void {
  memDb.exec(`
    CREATE TABLE outline_templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      genre TEXT NOT NULL,
      description TEXT,
      is_builtin INTEGER DEFAULT 0,
      source_project_id TEXT,
      structure TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);
}

describe('templateRepo', () => {
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
    it('creates a custom template', () => {
      const tpl = templateRepo.create({
        name: 'My Template',
        genre: 'fantasy',
        description: 'A custom outline structure',
        structure: JSON.stringify([{ title: 'Act 1', level: 0 }]),
      });

      expect(tpl).toBeDefined();
      expect(tpl.id).toBeTruthy();
      expect(tpl.name).toBe('My Template');
      expect(tpl.genre).toBe('fantasy');
      expect(tpl.description).toBe('A custom outline structure');
      expect(tpl.is_builtin).toBe(0);
      expect(tpl.structure).toBe(JSON.stringify([{ title: 'Act 1', level: 0 }]));
    });

    it('creates a builtin template', () => {
      const tpl = templateRepo.create({
        name: 'Builtin',
        genre: 'xianxia',
        isBuiltin: 1,
        structure: '[]',
      });

      expect(tpl.is_builtin).toBe(1);
    });

    it('creates a template with source_project_id', () => {
      const tpl = templateRepo.create({
        name: 'From Project',
        genre: 'fantasy',
        sourceProjectId: 'proj-123',
        structure: '[]',
      });

      expect(tpl.source_project_id).toBe('proj-123');
    });
  });

  describe('findAll', () => {
    it('returns all templates', () => {
      templateRepo.create({ name: 'A', genre: 'fantasy', structure: '[]' });
      templateRepo.create({ name: 'B', genre: 'scifi', structure: '[]' });

      const all = templateRepo.findAll();

      expect(all).toHaveLength(2);
    });

    it('returns empty array when no templates exist', () => {
      expect(templateRepo.findAll()).toEqual([]);
    });
  });

  describe('findByGenre', () => {
    it('returns templates for a specific genre', () => {
      templateRepo.create({ name: 'F1', genre: 'fantasy', structure: '[]' });
      templateRepo.create({ name: 'S1', genre: 'scifi', structure: '[]' });
      templateRepo.create({ name: 'F2', genre: 'fantasy', structure: '[]' });

      const fantasy = templateRepo.findByGenre('fantasy');

      expect(fantasy).toHaveLength(2);
      fantasy.forEach(t => expect(t.genre).toBe('fantasy'));
    });

    it('returns empty array for unknown genre', () => {
      templateRepo.create({ name: 'A', genre: 'fantasy', structure: '[]' });

      expect(templateRepo.findByGenre('romance')).toEqual([]);
    });
  });

  describe('findById', () => {
    it('returns template by id', () => {
      const created = templateRepo.create({ name: 'Find Me', genre: 'fantasy', structure: '[]' });

      const found = templateRepo.findById(created.id);

      expect(found).toBeDefined();
      expect(found!.name).toBe('Find Me');
    });

    it('returns undefined for non-existent id', () => {
      expect(templateRepo.findById('non-existent')).toBeUndefined();
    });
  });

  describe('update', () => {
    it('updates name and genre', () => {
      const created = templateRepo.create({ name: 'Original', genre: 'fantasy', structure: '[]' });

      const updated = templateRepo.update(created.id, { name: 'Updated', genre: 'scifi' });

      expect(updated!.name).toBe('Updated');
      expect(updated!.genre).toBe('scifi');
    });

    it('updates description and structure', () => {
      const created = templateRepo.create({ name: 'T', genre: 'fantasy', structure: '[]' });

      const updated = templateRepo.update(created.id, {
        description: 'New desc',
        structure: JSON.stringify([{ title: 'New Act', level: 0 }]),
      });

      expect(updated!.description).toBe('New desc');
      expect(updated!.structure).toBe(JSON.stringify([{ title: 'New Act', level: 0 }]));
    });

    it('returns existing template when no valid fields provided', () => {
      const created = templateRepo.create({ name: 'Same', genre: 'fantasy', structure: '[]' });

      const result = templateRepo.update(created.id, { unknown_field: 'ignored' });

      expect(result).toBeDefined();
      expect(result!.name).toBe('Same');
    });
  });

  describe('deleteById', () => {
    it('deletes a custom template and returns true', () => {
      const created = templateRepo.create({ name: 'Delete Me', genre: 'fantasy', structure: '[]' });

      expect(templateRepo.deleteById(created.id)).toBe(true);
      expect(templateRepo.findById(created.id)).toBeUndefined();
    });

    it('refuses to delete builtin templates', () => {
      const created = templateRepo.create({ name: 'Builtin', genre: 'fantasy', isBuiltin: 1, structure: '[]' });

      expect(templateRepo.deleteById(created.id)).toBe(false);
      expect(templateRepo.findById(created.id)).toBeDefined();
    });

    it('returns false for non-existent template', () => {
      expect(templateRepo.deleteById('non-existent')).toBe(false);
    });
  });

  describe('seedBuiltins', () => {
    it('seeds builtin templates when table is empty', () => {
      templateRepo.seedBuiltins();

      const all = templateRepo.findAll();
      expect(all).toHaveLength(2);
      expect(all.every(t => t.is_builtin === 1)).toBe(true);
    });

    it('does not re-seed when builtins already exist', () => {
      templateRepo.seedBuiltins();
      templateRepo.seedBuiltins();

      expect(templateRepo.findAll()).toHaveLength(2);
    });
  });
});
