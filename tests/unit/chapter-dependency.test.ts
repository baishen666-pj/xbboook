import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';

let testDb: Database.Database;

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
    CREATE TABLE volumes (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, title TEXT NOT NULL, summary TEXT,
      sort_order INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
    CREATE TABLE chapters (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, volume_id TEXT, title TEXT NOT NULL,
      summary TEXT, word_count INTEGER DEFAULT 0, file_path TEXT NOT NULL,
      status TEXT DEFAULT 'draft', sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (volume_id) REFERENCES volumes(id) ON DELETE SET NULL
    );
    CREATE TABLE chapter_dependencies (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL,
      source_chapter_id TEXT NOT NULL, target_chapter_id TEXT NOT NULL,
      dependency_type TEXT DEFAULT 'plot' CHECK(dependency_type IN ('plot','character','foreshadowing','timeline','worldview')),
      description TEXT DEFAULT '',
      strength TEXT DEFAULT 'normal' CHECK(strength IN ('weak','normal','strong')),
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (source_chapter_id) REFERENCES chapters(id) ON DELETE CASCADE,
      FOREIGN KEY (target_chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
    );
  `);
  return db;
}

describe('chapterDependencyRepo', () => {
  let projectId: string;
  let ch1: string, ch2: string, ch3: string;

  beforeEach(async () => {
    testDb = createTestDb();
    vi.doMock('../../server/db/database.js', () => ({
      getDb: () => testDb,
      closeDb: () => {},
    }));

    const { v4: uuid } = await import('uuid');
    projectId = uuid();
    ch1 = uuid();
    ch2 = uuid();
    ch3 = uuid();

    testDb.prepare('INSERT INTO projects (id, name) VALUES (?, ?)').run(projectId, 'Test');
    testDb.prepare('INSERT INTO chapters (id, project_id, title, file_path, sort_order) VALUES (?, ?, ?, ?, ?)').run(ch1, projectId, '第一章', '/c1.md', 0);
    testDb.prepare('INSERT INTO chapters (id, project_id, title, file_path, sort_order) VALUES (?, ?, ?, ?, ?)').run(ch2, projectId, '第二章', '/c2.md', 1);
    testDb.prepare('INSERT INTO chapters (id, project_id, title, file_path, sort_order) VALUES (?, ?, ?, ?, ?)').run(ch3, projectId, '第三章', '/c3.md', 2);
  });

  afterEach(() => {
    vi.doUnmock('../../server/db/database.js');
    vi.restoreAllMocks();
    if (testDb) testDb.close();
  });

  describe('create', () => {
    it('creates a dependency', async () => {
      const repo = await import('../../server/db/repositories/chapterDependencyRepo.js');
      const dep = repo.create({
        project_id: projectId,
        source_chapter_id: ch2,
        target_chapter_id: ch1,
        dependency_type: 'foreshadowing',
        description: '第二章回收第一章的伏笔',
      });
      expect(dep.source_chapter_id).toBe(ch2);
      expect(dep.target_chapter_id).toBe(ch1);
      expect(dep.dependency_type).toBe('foreshadowing');
    });
  });

  describe('findByProject', () => {
    it('returns edges with chapter titles', async () => {
      const repo = await import('../../server/db/repositories/chapterDependencyRepo.js');
      repo.create({ project_id: projectId, source_chapter_id: ch2, target_chapter_id: ch1 });

      const edges = repo.findByProject(projectId);
      expect(edges).toHaveLength(1);
      expect(edges[0].source_title).toBe('第二章');
      expect(edges[0].target_title).toBe('第一章');
    });
  });

  describe('findByChapter', () => {
    it('returns both incoming and outgoing deps', async () => {
      const repo = await import('../../server/db/repositories/chapterDependencyRepo.js');
      repo.create({ project_id: projectId, source_chapter_id: ch2, target_chapter_id: ch1 });
      repo.create({ project_id: projectId, source_chapter_id: ch3, target_chapter_id: ch2 });

      const deps = repo.findByChapter(ch2);
      expect(deps).toHaveLength(2);
    });
  });

  describe('update', () => {
    it('updates fields', async () => {
      const repo = await import('../../server/db/repositories/chapterDependencyRepo.js');
      const dep = repo.create({ project_id: projectId, source_chapter_id: ch2, target_chapter_id: ch1 });

      const updated = repo.update(dep.id, { strength: 'strong', description: '关键依赖' });
      expect(updated?.strength).toBe('strong');
      expect(updated?.description).toBe('关键依赖');
    });
  });

  describe('deleteById', () => {
    it('deletes a dependency', async () => {
      const repo = await import('../../server/db/repositories/chapterDependencyRepo.js');
      const dep = repo.create({ project_id: projectId, source_chapter_id: ch2, target_chapter_id: ch1 });
      expect(repo.deleteById(dep.id)).toBe(true);
      expect(repo.findById(dep.id)).toBeUndefined();
    });
  });

  describe('detectCircularDependencies', () => {
    it('detects a cycle', async () => {
      const repo = await import('../../server/db/repositories/chapterDependencyRepo.js');
      repo.create({ project_id: projectId, source_chapter_id: ch1, target_chapter_id: ch2 });
      repo.create({ project_id: projectId, source_chapter_id: ch2, target_chapter_id: ch3 });
      repo.create({ project_id: projectId, source_chapter_id: ch3, target_chapter_id: ch1 });

      const cycles = repo.detectCircularDependencies(projectId);
      expect(cycles.length).toBeGreaterThan(0);
    });

    it('returns empty for no cycles', async () => {
      const repo = await import('../../server/db/repositories/chapterDependencyRepo.js');
      repo.create({ project_id: projectId, source_chapter_id: ch2, target_chapter_id: ch1 });
      repo.create({ project_id: projectId, source_chapter_id: ch3, target_chapter_id: ch2 });

      const cycles = repo.detectCircularDependencies(projectId);
      expect(cycles).toHaveLength(0);
    });
  });

  describe('getStats', () => {
    it('returns stats', async () => {
      const repo = await import('../../server/db/repositories/chapterDependencyRepo.js');
      repo.create({ project_id: projectId, source_chapter_id: ch2, target_chapter_id: ch1, dependency_type: 'plot', strength: 'strong' });
      repo.create({ project_id: projectId, source_chapter_id: ch3, target_chapter_id: ch2, dependency_type: 'character', strength: 'normal' });

      const stats = repo.getStats(projectId);
      expect(stats.total).toBe(2);
      expect(stats.byType.plot).toBe(1);
      expect(stats.byType.character).toBe(1);
      expect(stats.byStrength.strong).toBe(1);
      expect(stats.circularCount).toBe(0);
    });
  });
});
