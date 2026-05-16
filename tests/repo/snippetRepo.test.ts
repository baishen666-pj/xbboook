import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';

let memDb: Database.Database;

vi.mock('../../server/db/database.js', () => ({
  getDb: () => memDb,
}));

import * as snippetRepo from '../../server/db/repositories/snippetRepo.js';

function setupTables(): void {
  memDb.exec(`
    CREATE TABLE projects (
      id TEXT PRIMARY KEY, name TEXT NOT NULL,
      status TEXT DEFAULT 'active', sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE snippet_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id TEXT,
      name TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'custom',
      content TEXT NOT NULL,
      is_builtin INTEGER DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
  `);
}

function seedProject(): string {
  const id = randomUUID();
  memDb.prepare("INSERT INTO projects (id, name) VALUES (?, 'Test Novel')").run(id);
  return id;
}

describe('snippetRepo', () => {
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
    it('creates a snippet with minimal data', () => {
      const projectId = seedProject();

      const snippet = snippetRepo.create({ projectId, name: 'Battle Scene', content: 'Swords clashed' });

      expect(snippet).toBeDefined();
      expect(snippet.id).toBeTruthy();
      expect(snippet.name).toBe('Battle Scene');
      expect(snippet.content).toBe('Swords clashed');
      expect(snippet.project_id).toBe(projectId);
      expect(snippet.category).toBe('custom');
      expect(snippet.is_builtin).toBe(0);
      expect(snippet.sort_order).toBe(0);
    });

    it('creates a snippet with all fields', () => {
      const projectId = seedProject();

      const snippet = snippetRepo.create({
        projectId,
        name: 'Dialogue Template',
        category: 'dialogue',
        content: '"Hello," she said.',
        sortOrder: 2,
      });

      expect(snippet.name).toBe('Dialogue Template');
      expect(snippet.category).toBe('dialogue');
      expect(snippet.content).toBe('"Hello," she said.');
      expect(snippet.sort_order).toBe(2);
    });

    it('creates a builtin snippet with null project_id', () => {
      const snippet = snippetRepo.create({
        projectId: null,
        name: 'System Template',
        category: 'system',
        content: 'Placeholder',
        isBuiltin: 1,
      });

      expect(snippet.project_id).toBeNull();
      expect(snippet.is_builtin).toBe(1);
      expect(snippet.category).toBe('system');
    });

    it('sets created_at timestamp', () => {
      const projectId = seedProject();

      const snippet = snippetRepo.create({ projectId, name: 'Test', content: 'Content' });

      expect(snippet.created_at).toBeTruthy();
    });
  });

  describe('findAll', () => {
    it('returns project snippets and builtin snippets', () => {
      const projectId = seedProject();

      snippetRepo.create({ projectId, name: 'Project Snippet', content: 'P' });
      snippetRepo.create({ projectId: null, name: 'Builtin Snippet', content: 'B', isBuiltin: 1 });

      const all = snippetRepo.findAll(projectId);

      expect(all).toHaveLength(2);
    });

    it('returns only builtin snippets when project has none', () => {
      const projectId = seedProject();

      snippetRepo.create({ projectId: null, name: 'Builtin', content: 'B', isBuiltin: 1 });

      const all = snippetRepo.findAll(projectId);

      expect(all).toHaveLength(1);
      expect(all[0].name).toBe('Builtin');
    });

    it('returns empty array when no snippets exist', () => {
      const projectId = seedProject();

      expect(snippetRepo.findAll(projectId)).toEqual([]);
    });

    it('does not return builtin snippets from other projects', () => {
      const p1 = seedProject();
      const p2 = seedProject();

      snippetRepo.create({ projectId: p1, name: 'P1 Snippet', content: 'P1' });
      snippetRepo.create({ projectId: p2, name: 'P2 Snippet', content: 'P2' });

      const results = snippetRepo.findAll(p1);

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('P1 Snippet');
    });

    it('orders by category then sort_order then id', () => {
      const projectId = seedProject();

      snippetRepo.create({ projectId, name: 'Z-Snippet', category: 'action', content: 'A', sortOrder: 2 });
      snippetRepo.create({ projectId, name: 'A-Snippet', category: 'dialogue', content: 'D', sortOrder: 0 });
      snippetRepo.create({ projectId, name: 'M-Snippet', category: 'action', content: 'A2', sortOrder: 1 });

      const all = snippetRepo.findAll(projectId);

      expect(all[0].category).toBe('action');
      expect(all[0].sort_order).toBeLessThan(all[1].sort_order);
      expect(all[2].category).toBe('dialogue');
    });
  });

  describe('findById', () => {
    it('returns snippet by id', () => {
      const projectId = seedProject();
      const created = snippetRepo.create({ projectId, name: 'Find Me', content: 'Content' });

      const found = snippetRepo.findById(created.id);

      expect(found).toBeDefined();
      expect(found!.name).toBe('Find Me');
    });

    it('returns undefined for non-existent id', () => {
      expect(snippetRepo.findById(99999)).toBeUndefined();
    });
  });

  describe('findByCategory', () => {
    it('returns snippets in the specified category', () => {
      const projectId = seedProject();

      snippetRepo.create({ projectId, name: 'Action 1', category: 'action', content: 'A' });
      snippetRepo.create({ projectId, name: 'Dialogue 1', category: 'dialogue', content: 'D' });
      snippetRepo.create({ projectId, name: 'Action 2', category: 'action', content: 'A2' });

      const actionSnippets = snippetRepo.findByCategory(projectId, 'action');

      expect(actionSnippets).toHaveLength(2);
      expect(actionSnippets.every((s) => s.category === 'action')).toBe(true);
    });

    it('includes builtin snippets in the same category', () => {
      const projectId = seedProject();

      snippetRepo.create({ projectId, name: 'Project Action', category: 'action', content: 'A' });
      snippetRepo.create({ projectId: null, name: 'Builtin Action', category: 'action', content: 'BA', isBuiltin: 1 });

      const results = snippetRepo.findByCategory(projectId, 'action');

      expect(results).toHaveLength(2);
    });

    it('returns empty array for category with no snippets', () => {
      const projectId = seedProject();

      expect(snippetRepo.findByCategory(projectId, 'nonexistent')).toEqual([]);
    });
  });

  describe('findBuiltin', () => {
    it('returns only builtin snippets', () => {
      const projectId = seedProject();

      snippetRepo.create({ projectId, name: 'Project', content: 'P' });
      snippetRepo.create({ projectId: null, name: 'Builtin 1', content: 'B1', isBuiltin: 1 });
      snippetRepo.create({ projectId: null, name: 'Builtin 2', content: 'B2', isBuiltin: 1 });

      const builtins = snippetRepo.findBuiltin();

      expect(builtins).toHaveLength(2);
      expect(builtins.every((s) => s.is_builtin === 1)).toBe(true);
    });

    it('returns empty array when no builtin snippets exist', () => {
      const projectId = seedProject();
      snippetRepo.create({ projectId, name: 'Project', content: 'P' });

      expect(snippetRepo.findBuiltin()).toEqual([]);
    });
  });

  describe('update', () => {
    it('updates name', () => {
      const projectId = seedProject();
      const created = snippetRepo.create({ projectId, name: 'Original', content: 'C' });

      const updated = snippetRepo.update(created.id, { name: 'Updated Name' });

      expect(updated!.name).toBe('Updated Name');
    });

    it('updates category', () => {
      const projectId = seedProject();
      const created = snippetRepo.create({ projectId, name: 'Snippet', content: 'C' });

      const updated = snippetRepo.update(created.id, { category: 'dialogue' });

      expect(updated!.category).toBe('dialogue');
    });

    it('updates content', () => {
      const projectId = seedProject();
      const created = snippetRepo.create({ projectId, name: 'Snippet', content: 'Old' });

      const updated = snippetRepo.update(created.id, { content: 'New content' });

      expect(updated!.content).toBe('New content');
    });

    it('updates sort_order', () => {
      const projectId = seedProject();
      const created = snippetRepo.create({ projectId, name: 'Snippet', content: 'C' });

      const updated = snippetRepo.update(created.id, { sort_order: 5 });

      expect(updated!.sort_order).toBe(5);
    });

    it('updates multiple fields at once', () => {
      const projectId = seedProject();
      const created = snippetRepo.create({ projectId, name: 'Original', content: 'Old' });

      const updated = snippetRepo.update(created.id, { name: 'New', content: 'Updated', sort_order: 3 });

      expect(updated!.name).toBe('New');
      expect(updated!.content).toBe('Updated');
      expect(updated!.sort_order).toBe(3);
    });

    it('returns undefined for non-existent snippet', () => {
      expect(snippetRepo.update(99999, { name: 'X' })).toBeUndefined();
    });

    it('returns existing snippet when no valid fields provided', () => {
      const projectId = seedProject();
      const created = snippetRepo.create({ projectId, name: 'Same', content: 'C' });

      const result = snippetRepo.update(created.id, { unknown_field: 'ignored' } as Record<string, unknown>);

      expect(result).toBeDefined();
      expect(result!.name).toBe('Same');
    });
  });

  describe('deleteById', () => {
    it('deletes a project snippet and returns true', () => {
      const projectId = seedProject();
      const created = snippetRepo.create({ projectId, name: 'Delete Me', content: 'C' });

      expect(snippetRepo.deleteById(created.id)).toBe(true);
      expect(snippetRepo.findById(created.id)).toBeUndefined();
    });

    it('returns false for non-existent snippet', () => {
      expect(snippetRepo.deleteById(99999)).toBe(false);
    });

    it('refuses to delete builtin snippets', () => {
      const created = snippetRepo.create({
        projectId: null,
        name: 'Builtin',
        content: 'B',
        isBuiltin: 1,
      });

      expect(snippetRepo.deleteById(created.id)).toBe(false);
      expect(snippetRepo.findById(created.id)).toBeDefined();
    });

    it('does not affect other snippets', () => {
      const projectId = seedProject();
      const s1 = snippetRepo.create({ projectId, name: 'Keep', content: 'K' });
      const s2 = snippetRepo.create({ projectId, name: 'Delete', content: 'D' });

      snippetRepo.deleteById(s2.id);

      const remaining = snippetRepo.findAll(projectId);
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe(s1.id);
    });
  });

  describe('countBuiltin', () => {
    it('returns count of builtin snippets', () => {
      snippetRepo.create({ projectId: null, name: 'B1', content: 'C1', isBuiltin: 1 });
      snippetRepo.create({ projectId: null, name: 'B2', content: 'C2', isBuiltin: 1 });

      expect(snippetRepo.countBuiltin()).toBe(2);
    });

    it('returns 0 when no builtin snippets exist', () => {
      const projectId = seedProject();
      snippetRepo.create({ projectId, name: 'Project', content: 'P' });

      expect(snippetRepo.countBuiltin()).toBe(0);
    });
  });
});
