import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';

let memDb: Database.Database;

vi.mock('../../server/db/database.js', () => ({
  getDb: () => memDb,
}));

import * as repo from '../../server/db/repositories/keyboardMacroRepo.js';

function setupTables(): void {
  memDb.exec(`
    CREATE TABLE projects (
      id TEXT PRIMARY KEY, name TEXT NOT NULL,
      status TEXT DEFAULT 'active', sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE keyboard_macros (
      id TEXT PRIMARY KEY,
      project_id TEXT,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      trigger TEXT NOT NULL,
      actions TEXT NOT NULL DEFAULT '[]',
      enabled INTEGER DEFAULT 1,
      scope TEXT DEFAULT 'global' CHECK(scope IN ('global','project','chapter')),
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
  `);
}

function seedProject(): string {
  const id = randomUUID();
  memDb.prepare("INSERT INTO projects (id, name) VALUES (?, 'Test')").run(id);
  return id;
}

describe('keyboardMacroRepo', () => {
  beforeEach(() => {
    memDb = new Database(':memory:');
    memDb.pragma('foreign_keys = ON');
    setupTables();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (memDb) memDb.close();
  });

  describe('create + findAll', () => {
    it('creates a macro and retrieves it', () => {
      const pid = seedProject();
      const macro = repo.create({
        id: randomUUID(), projectId: pid, name: 'Insert Divider',
        trigger: 'ctrl+shift+d', actions: [{ type: 'insert', value: '---' }], scope: 'project',
      });
      expect(macro.name).toBe('Insert Divider');
      expect(macro.trigger).toBe('ctrl+shift+d');
      expect(macro.actions).toHaveLength(1);
      expect(macro.enabled).toBe(true);

      const macros = repo.findAll(pid);
      expect(macros).toHaveLength(1);
    });

    it('returns global macros when no projectId', () => {
      repo.create({ id: randomUUID(), name: 'Global Macro', trigger: 'ctrl+g', actions: [{ type: 'command', value: 'save' }], scope: 'global' });
      expect(repo.findAll()).toHaveLength(1);
    });

    it('includes both project and global macros', () => {
      const pid = seedProject();
      repo.create({ id: randomUUID(), projectId: pid, name: 'Project', trigger: 'ctrl+p', actions: [{ type: 'insert', value: 'text' }], scope: 'project' });
      repo.create({ id: randomUUID(), name: 'Global', trigger: 'ctrl+g', actions: [{ type: 'command', value: 'save' }], scope: 'global' });
      expect(repo.findAll(pid)).toHaveLength(2);
    });
  });

  describe('update', () => {
    it('updates a macro', () => {
      const pid = seedProject();
      const macro = repo.create({ id: randomUUID(), projectId: pid, name: 'Old', trigger: 'ctrl+a', actions: [{ type: 'insert', value: 'old' }], scope: 'project' });
      const updated = repo.update(macro.id, { name: 'New', actions: [{ type: 'replace', value: 'new' }] });
      expect(updated!.name).toBe('New');
      expect(updated!.actions).toHaveLength(1);
      expect(updated!.actions[0].type).toBe('replace');
    });

    it('disables a macro', () => {
      const pid = seedProject();
      const macro = repo.create({ id: randomUUID(), projectId: pid, name: 'Test', trigger: 'ctrl+t', actions: [{ type: 'insert', value: 'x' }], scope: 'project' });
      repo.update(macro.id, { enabled: false });
      // Disabled macros should not appear in findAll (which filters enabled=1)
      expect(repo.findAll(pid)).toHaveLength(0);
    });

    it('returns undefined for non-existent', () => {
      expect(repo.update('non-existent', { name: 'X' })).toBeUndefined();
    });
  });

  describe('remove', () => {
    it('deletes a macro', () => {
      const pid = seedProject();
      const macro = repo.create({ id: randomUUID(), projectId: pid, name: 'Delete', trigger: 'ctrl+d', actions: [{ type: 'insert', value: 'x' }], scope: 'project' });
      expect(repo.remove(macro.id)).toBe(true);
      expect(repo.findAll(pid)).toHaveLength(0);
    });

    it('returns false for non-existent', () => {
      expect(repo.remove('non-existent')).toBe(false);
    });
  });
});
