import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
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
    CREATE TABLE chat_messages (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, chapter_id TEXT,
      role TEXT NOT NULL CHECK(role IN ('user','assistant','system')),
      content TEXT NOT NULL, skill_id TEXT DEFAULT '', token_usage INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
    );
    CREATE TABLE daily_stats (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, date TEXT NOT NULL,
      words_added INTEGER DEFAULT 0, words_total INTEGER DEFAULT 0,
      writing_time_ms INTEGER DEFAULT 0, chapters_worked INTEGER DEFAULT 0,
      UNIQUE(project_id, date),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
    CREATE TABLE writing_sessions (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, chapter_id TEXT NOT NULL,
      started_at TEXT NOT NULL, ended_at TEXT,
      words_start INTEGER DEFAULT 0, words_end INTEGER DEFAULT 0, duration_ms INTEGER DEFAULT 0,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
    );
    CREATE TABLE project_members (
      project_id TEXT NOT NULL, user_id TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'writer', joined_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (project_id, user_id)
    );
    CREATE TABLE chapter_locks (
      chapter_id TEXT PRIMARY KEY, user_id TEXT NOT NULL,
      locked_at TEXT DEFAULT (datetime('now')), expires_at TEXT
    );
    CREATE TABLE chapter_versions (
      id TEXT PRIMARY KEY, chapter_id TEXT NOT NULL, project_id TEXT NOT NULL,
      version_number INTEGER NOT NULL, content_hash TEXT NOT NULL,
      word_count INTEGER DEFAULT 0, snapshot_type TEXT DEFAULT 'auto', label TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE worldviews (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, category TEXT NOT NULL,
      title TEXT NOT NULL, content TEXT, sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
    CREATE TABLE outlines (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, level INTEGER DEFAULT 0,
      parent_id TEXT, target_ref_id TEXT, title TEXT NOT NULL, content TEXT,
      sort_order INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
    CREATE TABLE chapter_comments (
      id TEXT PRIMARY KEY, chapter_id TEXT NOT NULL, project_id TEXT NOT NULL,
      user_id TEXT NOT NULL, content TEXT NOT NULL,
      selection_from INTEGER, selection_to INTEGER, selection_text TEXT,
      resolved INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
    );
  `);
  return db;
}

describe('Scenes Routes', () => {
  let app: any;
  let projectId: string;
  let chapterId: string;

  beforeEach(async () => {
    testDb = createTestDb();
    vi.doMock('../../server/db/database.js', () => ({
      getDb: () => testDb,
      closeDb: () => {},
    }));
    vi.doMock('../../server/ws/presenceManager.js', () => ({
      generateToken: (uid: string) => `test-token-${uid}`,
      validateToken: (token: string) => {
        const match = token.match(/^test-token-(.+)$/);
        return match ? match[1] : null;
      },
      addConnection: vi.fn(),
      removeConnection: vi.fn(),
      getOnlineUsers: () => [],
      broadcastToProject: vi.fn(),
    }));
    vi.doMock('../../server/services/fileService.js', () => ({
      readChapter: vi.fn().mockResolvedValue(''),
      writeChapter: vi.fn(),
      deleteChapter: vi.fn(),
      ensureProjectDir: vi.fn().mockResolvedValue(undefined),
      deleteProjectDir: vi.fn().mockResolvedValue(undefined),
    }));
    vi.doMock('../../server/services/analyticsService.js', async () => {
      const actual = await vi.importActual<typeof import('../../server/services/analyticsService.js')>(
        '../../server/services/analyticsService.js',
      );
      return {
        ...actual,
        getCharacterAppearances: async () => [],
      };
    });
    const mod = await import('../../server/app.js');
    app = mod.default;

    const res = await request(app)
      .post('/api/projects')
      .send({ name: 'Scenes Test Project', genre: 'fantasy', writing_mode: 'webnovel' });
    projectId = res.body.data.id;

    const chRes = await request(app)
      .post(`/api/projects/${projectId}/chapters`)
      .send({ title: 'Chapter 1' });
    chapterId = chRes.body.data.id;
  });

  afterEach(() => {
    vi.doUnmock('../../server/db/database.js');
    vi.doUnmock('../../server/ws/presenceManager.js');
    vi.doUnmock('../../server/services/fileService.js');
    vi.doUnmock('../../server/services/analyticsService.js');
    vi.restoreAllMocks();
    if (testDb) testDb.close();
  });

  describe('GET /api/projects/:projectId/scenes', () => {
    it('returns empty list for new project', async () => {
      const res = await request(app).get(`/api/projects/${projectId}/scenes`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual([]);
    });
  });

  describe('POST /api/projects/:projectId/scenes', () => {
    it('creates a scene', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/scenes`)
        .send({ title: '雨夜相遇', chapterId });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('雨夜相遇');
      expect(res.body.data.chapter_id).toBe(chapterId);
      expect(res.body.data.status).toBe('draft');
    });

    it('creates scene with full metadata', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/scenes`)
        .send({
          title: '决战',
          chapterId,
          summary: '主角与反派的最终对决',
          mood: 'tense',
          location: '天台',
          timeOfDay: 'night',
          tags: ['高潮', '转折'],
          status: 'writing',
          wordCount: 2000,
          notes: '注意节奏把控',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.mood).toBe('tense');
      expect(res.body.data.location).toBe('天台');
      expect(res.body.data.word_count).toBe(2000);
    });

    it('rejects missing title', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/scenes`)
        .send({ chapterId });

      expect(res.status).toBe(400);
    });

    it('rejects missing chapterId', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/scenes`)
        .send({ title: 'Test' });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/projects/:projectId/scenes/:sceneId', () => {
    it('returns scene by id', async () => {
      const createRes = await request(app)
        .post(`/api/projects/${projectId}/scenes`)
        .send({ title: 'Test Scene', chapterId });
      const sceneId = createRes.body.data.id;

      const res = await request(app).get(`/api/projects/${projectId}/scenes/${sceneId}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(sceneId);
    });

    it('returns 404 for non-existent scene', async () => {
      const res = await request(app).get(`/api/projects/${projectId}/scenes/nonexistent`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe('PUT /api/projects/:projectId/scenes/:sceneId', () => {
    it('updates scene title and status', async () => {
      const createRes = await request(app)
        .post(`/api/projects/${projectId}/scenes`)
        .send({ title: 'Original', chapterId });
      const sceneId = createRes.body.data.id;

      const res = await request(app)
        .put(`/api/projects/${projectId}/scenes/${sceneId}`)
        .send({ title: 'Updated', status: 'writing' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('Updated');
      expect(res.body.data.status).toBe('writing');
    });

    it('returns 404 for non-existent scene', async () => {
      const res = await request(app)
        .put(`/api/projects/${projectId}/scenes/nonexistent`)
        .send({ title: 'Updated' });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/projects/:projectId/scenes/:sceneId', () => {
    it('deletes a scene', async () => {
      const createRes = await request(app)
        .post(`/api/projects/${projectId}/scenes`)
        .send({ title: 'To Delete', chapterId });
      const sceneId = createRes.body.data.id;

      const res = await request(app).delete(`/api/projects/${projectId}/scenes/${sceneId}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('returns 404 for non-existent scene', async () => {
      const res = await request(app).delete(`/api/projects/${projectId}/scenes/nonexistent`);

      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/projects/:projectId/scenes/chapter/:chapterId', () => {
    it('returns scenes for a chapter', async () => {
      await request(app)
        .post(`/api/projects/${projectId}/scenes`)
        .send({ title: 'Scene 1', chapterId });
      await request(app)
        .post(`/api/projects/${projectId}/scenes`)
        .send({ title: 'Scene 2', chapterId });

      const res = await request(app).get(`/api/projects/${projectId}/scenes/chapter/${chapterId}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
    });
  });

  describe('GET /api/projects/:projectId/scenes/stats', () => {
    it('returns scene statistics', async () => {
      await request(app)
        .post(`/api/projects/${projectId}/scenes`)
        .send({ title: 'Scene 1', chapterId, status: 'done', wordCount: 1000, mood: 'tense' });
      await request(app)
        .post(`/api/projects/${projectId}/scenes`)
        .send({ title: 'Scene 2', chapterId, status: 'draft', wordCount: 500, mood: 'calm' });

      const res = await request(app).get(`/api/projects/${projectId}/scenes/stats`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.total).toBe(2);
      expect(res.body.data.totalWords).toBe(1500);
      expect(res.body.data.byStatus.done).toBe(1);
      expect(res.body.data.byStatus.draft).toBe(1);
    });
  });

  describe('POST /api/projects/:projectId/scenes/reorder', () => {
    it('reorders scenes', async () => {
      const s1 = await request(app)
        .post(`/api/projects/${projectId}/scenes`)
        .send({ title: 'Scene 1', chapterId });
      const s2 = await request(app)
        .post(`/api/projects/${projectId}/scenes`)
        .send({ title: 'Scene 2', chapterId });
      const id1 = s1.body.data.id;
      const id2 = s2.body.data.id;

      const res = await request(app)
        .post(`/api/projects/${projectId}/scenes/reorder`)
        .send({ sceneIds: [id2, id1] });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const listRes = await request(app).get(`/api/projects/${projectId}/scenes/chapter/${chapterId}`);
      expect(listRes.body.data[0].id).toBe(id2);
      expect(listRes.body.data[1].id).toBe(id1);
    });
  });

  describe('Full CRUD workflow', () => {
    it('creates, reads, updates, and deletes a scene', async () => {
      // Create
      const createRes = await request(app)
        .post(`/api/projects/${projectId}/scenes`)
        .send({ title: 'Workflow Scene', chapterId, mood: 'action', location: 'arena' });
      expect(createRes.status).toBe(201);
      const sceneId = createRes.body.data.id;

      // Read
      const getRes = await request(app).get(`/api/projects/${projectId}/scenes/${sceneId}`);
      expect(getRes.status).toBe(200);
      expect(getRes.body.data.title).toBe('Workflow Scene');
      expect(getRes.body.data.mood).toBe('action');

      // Update
      const updateRes = await request(app)
        .put(`/api/projects/${projectId}/scenes/${sceneId}`)
        .send({ title: 'Updated Scene', status: 'done', wordCount: 3000 });
      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.title).toBe('Updated Scene');
      expect(updateRes.body.data.status).toBe('done');

      // Delete
      const deleteRes = await request(app).delete(`/api/projects/${projectId}/scenes/${sceneId}`);
      expect(deleteRes.status).toBe(200);

      // Verify deleted
      const listRes = await request(app).get(`/api/projects/${projectId}/scenes`);
      expect(listRes.body.data).toHaveLength(0);
    });
  });
});
