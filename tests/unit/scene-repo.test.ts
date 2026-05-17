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
    CREATE TABLE characters (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, name TEXT NOT NULL,
      nickname TEXT, role_type TEXT DEFAULT 'supporting', gender TEXT, age TEXT,
      appearance TEXT, personality TEXT, background TEXT, abilities TEXT, notes TEXT,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')),
      speech_style TEXT, verbal_tics TEXT, vocabulary_level TEXT DEFAULT 'moderate',
      sentence_length_pref TEXT DEFAULT 'medium', emotional_expressiveness TEXT DEFAULT 'moderate',
      voice_examples TEXT,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
    CREATE TABLE scenes (
      id TEXT PRIMARY KEY, chapter_id TEXT NOT NULL, project_id TEXT NOT NULL,
      title TEXT NOT NULL, summary TEXT DEFAULT '',
      content_start_offset INTEGER DEFAULT 0, content_end_offset INTEGER DEFAULT 0,
      tags TEXT DEFAULT '[]', mood TEXT DEFAULT '', location TEXT DEFAULT '',
      time_of_day TEXT DEFAULT '', pov_character_id TEXT,
      sort_order INTEGER DEFAULT 0,
      status TEXT DEFAULT 'draft' CHECK(status IN ('draft','writing','revising','done')),
      word_count INTEGER DEFAULT 0, notes TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (pov_character_id) REFERENCES characters(id) ON DELETE SET NULL
    );
  `);
  return db;
}

describe('sceneRepo', () => {
  let projectId: string;
  let chapterId: string;
  let characterId: string;

  beforeEach(async () => {
    testDb = createTestDb();
    vi.doMock('../../server/db/database.js', () => ({
      getDb: () => testDb,
      closeDb: () => {},
    }));

    const { v4: uuid } = await import('uuid');
    projectId = uuid();
    chapterId = uuid();
    characterId = uuid();

    testDb.prepare('INSERT INTO projects (id, name) VALUES (?, ?)').run(projectId, 'Test Project');
    testDb.prepare('INSERT INTO chapters (id, project_id, title, file_path) VALUES (?, ?, ?, ?)').run(chapterId, projectId, 'Chapter 1', '/test/ch1.md');
    testDb.prepare('INSERT INTO characters (id, project_id, name) VALUES (?, ?, ?)').run(characterId, projectId, '主角');
  });

  afterEach(() => {
    vi.doUnmock('../../server/db/database.js');
    vi.restoreAllMocks();
    if (testDb) testDb.close();
  });

  describe('create', () => {
    it('creates a scene with minimal fields', async () => {
      const sceneRepo = await import('../../server/db/repositories/sceneRepo.js');
      const scene = sceneRepo.create({
        chapter_id: chapterId,
        project_id: projectId,
        title: '开场',
      });

      expect(scene.id).toBeTruthy();
      expect(scene.title).toBe('开场');
      expect(scene.status).toBe('draft');
      expect(scene.tags).toBe('[]');
    });

    it('creates a scene with all fields', async () => {
      const sceneRepo = await import('../../server/db/repositories/sceneRepo.js');
      const scene = sceneRepo.create({
        chapter_id: chapterId,
        project_id: projectId,
        title: '决战',
        summary: '最终对决',
        mood: 'tense',
        location: '天台',
        time_of_day: 'night',
        pov_character_id: characterId,
        tags: '["高潮","转折"]',
        status: 'writing',
        word_count: 3000,
        notes: '注意节奏',
        sort_order: 5,
      });

      expect(scene.mood).toBe('tense');
      expect(scene.location).toBe('天台');
      expect(scene.pov_character_id).toBe(characterId);
      expect(scene.word_count).toBe(3000);
    });
  });

  describe('findByProject', () => {
    it('returns all scenes for a project', async () => {
      const sceneRepo = await import('../../server/db/repositories/sceneRepo.js');
      sceneRepo.create({ chapter_id: chapterId, project_id: projectId, title: 'S1' });
      sceneRepo.create({ chapter_id: chapterId, project_id: projectId, title: 'S2' });

      const scenes = sceneRepo.findByProject(projectId);
      expect(scenes).toHaveLength(2);
    });
  });

  describe('findByChapter', () => {
    it('returns scenes ordered by sort_order', async () => {
      const sceneRepo = await import('../../server/db/repositories/sceneRepo.js');
      sceneRepo.create({ chapter_id: chapterId, project_id: projectId, title: 'S1', sort_order: 2 });
      sceneRepo.create({ chapter_id: chapterId, project_id: projectId, title: 'S2', sort_order: 1 });

      const scenes = sceneRepo.findByChapter(chapterId);
      expect(scenes[0].title).toBe('S2');
      expect(scenes[1].title).toBe('S1');
    });
  });

  describe('update', () => {
    it('updates specific fields', async () => {
      const sceneRepo = await import('../../server/db/repositories/sceneRepo.js');
      const scene = sceneRepo.create({ chapter_id: chapterId, project_id: projectId, title: 'Original' });

      const updated = sceneRepo.update(scene.id, { title: 'Updated', status: 'done' });

      expect(updated?.title).toBe('Updated');
      expect(updated?.status).toBe('done');
    });

    it('returns undefined for non-existent scene', async () => {
      const sceneRepo = await import('../../server/db/repositories/sceneRepo.js');
      const updated = sceneRepo.update('nonexistent', { title: 'X' });
      expect(updated).toBeUndefined();
    });
  });

  describe('deleteById', () => {
    it('deletes a scene', async () => {
      const sceneRepo = await import('../../server/db/repositories/sceneRepo.js');
      const scene = sceneRepo.create({ chapter_id: chapterId, project_id: projectId, title: 'ToDelete' });

      expect(sceneRepo.deleteById(scene.id)).toBe(true);
      expect(sceneRepo.findById(scene.id)).toBeUndefined();
    });

    it('returns false for non-existent scene', async () => {
      const sceneRepo = await import('../../server/db/repositories/sceneRepo.js');
      expect(sceneRepo.deleteById('nonexistent')).toBe(false);
    });
  });

  describe('reorder', () => {
    it('reorders scenes by given id array', async () => {
      const sceneRepo = await import('../../server/db/repositories/sceneRepo.js');
      const s1 = sceneRepo.create({ chapter_id: chapterId, project_id: projectId, title: 'S1', sort_order: 0 });
      const s2 = sceneRepo.create({ chapter_id: chapterId, project_id: projectId, title: 'S2', sort_order: 1 });
      const s3 = sceneRepo.create({ chapter_id: chapterId, project_id: projectId, title: 'S3', sort_order: 2 });

      sceneRepo.reorder([s3.id, s1.id, s2.id]);

      const scenes = sceneRepo.findByChapter(chapterId);
      expect(scenes[0].id).toBe(s3.id);
      expect(scenes[1].id).toBe(s1.id);
      expect(scenes[2].id).toBe(s2.id);
    });
  });

  describe('getStatsByProject', () => {
    it('computes correct statistics', async () => {
      const sceneRepo = await import('../../server/db/repositories/sceneRepo.js');
      sceneRepo.create({ chapter_id: chapterId, project_id: projectId, title: 'S1', status: 'done', word_count: 1000, mood: 'tense' });
      sceneRepo.create({ chapter_id: chapterId, project_id: projectId, title: 'S2', status: 'draft', word_count: 500, mood: 'calm' });
      sceneRepo.create({ chapter_id: chapterId, project_id: projectId, title: 'S3', status: 'done', word_count: 800, mood: 'tense' });

      const stats = sceneRepo.getStatsByProject(projectId);

      expect(stats.total).toBe(3);
      expect(stats.totalWords).toBe(2300);
      expect(stats.byStatus.done).toBe(2);
      expect(stats.byStatus.draft).toBe(1);
      expect(stats.byMood.tense).toBe(2);
      expect(stats.byMood.calm).toBe(1);
    });
  });

  describe('findByIdWithPov', () => {
    it('includes pov character name', async () => {
      const sceneRepo = await import('../../server/db/repositories/sceneRepo.js');
      const scene = sceneRepo.create({
        chapter_id: chapterId,
        project_id: projectId,
        title: 'POV Scene',
        pov_character_id: characterId,
      });

      const withPov = sceneRepo.findByIdWithPov(scene.id);
      expect(withPov?.pov_name).toBe('主角');
    });

    it('returns null pov_name when no character assigned', async () => {
      const sceneRepo = await import('../../server/db/repositories/sceneRepo.js');
      const scene = sceneRepo.create({
        chapter_id: chapterId,
        project_id: projectId,
        title: 'No POV',
      });

      const withPov = sceneRepo.findByIdWithPov(scene.id);
      expect(withPov?.pov_name).toBeNull();
    });
  });
});
