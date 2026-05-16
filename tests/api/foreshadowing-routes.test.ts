import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import Database from 'better-sqlite3';

let testDb: Database.Database;
let app: any;

function createTestDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE projects (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT, genre TEXT,
      writing_style TEXT, writing_mode TEXT DEFAULT 'webnovel', target_words INTEGER,
      daily_target INTEGER DEFAULT 0, status TEXT DEFAULT 'active', sort_order INTEGER DEFAULT 0,
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
      status TEXT DEFAULT 'draft', publish_status TEXT DEFAULT 'draft',
      scheduled_at TEXT, sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (volume_id) REFERENCES volumes(id) ON DELETE SET NULL
    );
    CREATE TABLE characters (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, name TEXT NOT NULL, nickname TEXT,
      role_type TEXT DEFAULT 'supporting', gender TEXT, age TEXT, appearance TEXT,
      personality TEXT, background TEXT, abilities TEXT, notes TEXT,
      sort_order INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
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
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (parent_id) REFERENCES outlines(id) ON DELETE CASCADE
    );
    CREATE TABLE daily_stats (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, date TEXT NOT NULL,
      words_added INTEGER DEFAULT 0, words_total INTEGER DEFAULT 0,
      writing_time_ms INTEGER DEFAULT 0, chapters_worked INTEGER DEFAULT 0,
      UNIQUE(project_id, date),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
    CREATE TABLE chapter_versions (
      id TEXT PRIMARY KEY, chapter_id TEXT NOT NULL, project_id TEXT NOT NULL,
      version_number INTEGER NOT NULL, content_hash TEXT NOT NULL,
      word_count INTEGER DEFAULT 0, snapshot_type TEXT DEFAULT 'auto', label TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
    );
    CREATE TABLE writing_sessions (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, chapter_id TEXT NOT NULL,
      started_at TEXT NOT NULL, ended_at TEXT,
      words_start INTEGER DEFAULT 0, words_end INTEGER DEFAULT 0, duration_ms INTEGER DEFAULT 0,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
    );
    CREATE TABLE outline_templates (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, genre TEXT NOT NULL, description TEXT,
      is_builtin INTEGER DEFAULT 0, source_project_id TEXT, structure TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE users (
      id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL, avatar_color TEXT NOT NULL DEFAULT '#6366f1',
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE project_members (
      project_id TEXT NOT NULL, user_id TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'writer', joined_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (project_id, user_id),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE chapter_locks (
      chapter_id TEXT PRIMARY KEY, user_id TEXT NOT NULL,
      locked_at TEXT DEFAULT (datetime('now')), expires_at TEXT,
      FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE chapter_comments (
      id TEXT PRIMARY KEY, chapter_id TEXT NOT NULL, project_id TEXT NOT NULL,
      user_id TEXT NOT NULL, content TEXT NOT NULL,
      selection_from INTEGER, selection_to INTEGER, selection_text TEXT,
      resolved INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE foreshadowing (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, title TEXT NOT NULL,
      description TEXT, plant_chapter_id TEXT, expected_harvest_chapter_id TEXT,
      actual_harvest_chapter_id TEXT,
      status TEXT NOT NULL DEFAULT 'planted' CHECK(status IN ('planted','harvested','forgotten')),
      importance TEXT DEFAULT 'normal' CHECK(importance IN ('critical','important','normal','minor')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (plant_chapter_id) REFERENCES chapters(id) ON DELETE SET NULL,
      FOREIGN KEY (expected_harvest_chapter_id) REFERENCES chapters(id) ON DELETE SET NULL,
      FOREIGN KEY (actual_harvest_chapter_id) REFERENCES chapters(id) ON DELETE SET NULL
    );
  `);
  return db;
}

describe('Foreshadowing API', () => {
  let projectId: string;

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
    vi.doMock('../../server/services/analyticsService.js', () => ({
      getDashboardData: () => ({
        summary: { totalWords: 0, totalDays: 0, avgDaily: 0, bestDay: null },
        velocity: [],
        chapterStatus: [],
        streak: { current: 0, longest: 0 },
        target: { target: 0, current: 0, percentage: 0 },
        peakHours: Array.from({ length: 24 }, (_, h) => ({ hour: h, count: 0 })),
      }),
      getCharacterAppearances: async () => [],
    }));
    const mod = await import('../../server/app.js');
    app = mod.default;

    const projRes = await request(app)
      .post('/api/projects')
      .send({ name: 'Foreshadowing Test Project' });
    projectId = projRes.body.data.id;
  });

  afterEach(() => {
    vi.doUnmock('../../server/db/database.js');
    vi.doUnmock('../../server/ws/presenceManager.js');
    vi.doUnmock('../../server/services/analyticsService.js');
    vi.restoreAllMocks();
    if (testDb) testDb.close();
  });

  describe('POST /api/foreshadowing/:projectId', () => {
    it('should create a foreshadowing with required fields', async () => {
      const res = await request(app)
        .post(`/api/foreshadowing/${projectId}`)
        .send({ title: '神秘老人' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.title).toBe('神秘老人');
      expect(res.body.data.status).toBe('planted');
      expect(res.body.data.importance).toBe('normal');
      expect(res.body.data.description).toBeNull();
      expect(res.body.data.plant_chapter_id).toBeNull();
    });

    it('should create a foreshadowing with all fields', async () => {
      const chapterRes = await request(app)
        .post(`/api/projects/${projectId}/chapters`)
        .send({ title: '第一章' });
      const chapterId = chapterRes.body.data.id;

      const res = await request(app)
        .post(`/api/foreshadowing/${projectId}`)
        .send({
          title: '神秘老人',
          description: '第一章出现的神秘老人',
          plant_chapter_id: chapterId,
          expected_harvest_chapter_id: chapterId,
          importance: 'critical',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.title).toBe('神秘老人');
      expect(res.body.data.description).toBe('第一章出现的神秘老人');
      expect(res.body.data.plant_chapter_id).toBe(chapterId);
      expect(res.body.data.importance).toBe('critical');
    });

    it('should reject missing title', async () => {
      const res = await request(app)
        .post(`/api/foreshadowing/${projectId}`)
        .send({ description: 'no title' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject empty title', async () => {
      const res = await request(app)
        .post(`/api/foreshadowing/${projectId}`)
        .send({ title: '' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject invalid importance', async () => {
      const res = await request(app)
        .post(`/api/foreshadowing/${projectId}`)
        .send({ title: 'Test', importance: 'invalid' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should default importance to normal when not specified', async () => {
      const res = await request(app)
        .post(`/api/foreshadowing/${projectId}`)
        .send({ title: 'Default Importance' });

      expect(res.status).toBe(201);
      expect(res.body.data.importance).toBe('normal');
    });
  });

  describe('GET /api/foreshadowing/:projectId', () => {
    it('should return empty array when no foreshadowing exists', async () => {
      const res = await request(app)
        .get(`/api/foreshadowing/${projectId}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual([]);
    });

    it('should list all foreshadowing for a project', async () => {
      await request(app)
        .post(`/api/foreshadowing/${projectId}`)
        .send({ title: '伏笔A' });
      await request(app)
        .post(`/api/foreshadowing/${projectId}`)
        .send({ title: '伏笔B', importance: 'critical' });

      const res = await request(app)
        .get(`/api/foreshadowing/${projectId}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });

    it('should filter by status', async () => {
      const createRes = await request(app)
        .post(`/api/foreshadowing/${projectId}`)
        .send({ title: '伏笔A' });
      const id = createRes.body.data.id;

      await request(app)
        .patch(`/api/foreshadowing/${projectId}/${id}`)
        .send({ status: 'harvested' });

      await request(app)
        .post(`/api/foreshadowing/${projectId}`)
        .send({ title: '伏笔B' });

      const plantedRes = await request(app)
        .get(`/api/foreshadowing/${projectId}?status=planted`);

      expect(plantedRes.body.data).toHaveLength(1);
      expect(plantedRes.body.data[0].status).toBe('planted');

      const harvestedRes = await request(app)
        .get(`/api/foreshadowing/${projectId}?status=harvested`);

      expect(harvestedRes.body.data).toHaveLength(1);
      expect(harvestedRes.body.data[0].status).toBe('harvested');
    });

    it('should only return foreshadowing for the specified project', async () => {
      const projectBRes = await request(app)
        .post('/api/projects')
        .send({ name: 'Other Project' });
      const projectB = projectBRes.body.data.id;

      await request(app)
        .post(`/api/foreshadowing/${projectId}`)
        .send({ title: 'A Only' });
      await request(app)
        .post(`/api/foreshadowing/${projectB}`)
        .send({ title: 'B Only' });

      const resA = await request(app).get(`/api/foreshadowing/${projectId}`);
      const resB = await request(app).get(`/api/foreshadowing/${projectB}`);

      expect(resA.body.data).toHaveLength(1);
      expect(resA.body.data[0].title).toBe('A Only');
      expect(resB.body.data).toHaveLength(1);
      expect(resB.body.data[0].title).toBe('B Only');
    });
  });

  describe('PATCH /api/foreshadowing/:projectId/:id', () => {
    it('should update title', async () => {
      const createRes = await request(app)
        .post(`/api/foreshadowing/${projectId}`)
        .send({ title: 'Original' });

      const res = await request(app)
        .patch(`/api/foreshadowing/${projectId}/${createRes.body.data.id}`)
        .send({ title: 'Updated' });

      expect(res.status).toBe(200);
      expect(res.body.data.title).toBe('Updated');
    });

    it('should update status', async () => {
      const createRes = await request(app)
        .post(`/api/foreshadowing/${projectId}`)
        .send({ title: 'Test' });

      const res = await request(app)
        .patch(`/api/foreshadowing/${projectId}/${createRes.body.data.id}`)
        .send({ status: 'harvested' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('harvested');
    });

    it('should update importance', async () => {
      const createRes = await request(app)
        .post(`/api/foreshadowing/${projectId}`)
        .send({ title: 'Test' });

      const res = await request(app)
        .patch(`/api/foreshadowing/${projectId}/${createRes.body.data.id}`)
        .send({ importance: 'critical' });

      expect(res.status).toBe(200);
      expect(res.body.data.importance).toBe('critical');
    });

    it('should update description', async () => {
      const createRes = await request(app)
        .post(`/api/foreshadowing/${projectId}`)
        .send({ title: 'Test' });

      const res = await request(app)
        .patch(`/api/foreshadowing/${projectId}/${createRes.body.data.id}`)
        .send({ description: 'New description' });

      expect(res.status).toBe(200);
      expect(res.body.data.description).toBe('New description');
    });

    it('should set description to null', async () => {
      const createRes = await request(app)
        .post(`/api/foreshadowing/${projectId}`)
        .send({ title: 'Test', description: 'Has description' });

      const res = await request(app)
        .patch(`/api/foreshadowing/${projectId}/${createRes.body.data.id}`)
        .send({ description: null });

      expect(res.status).toBe(200);
      expect(res.body.data.description).toBeNull();
    });

    it('should return 404 for non-existent foreshadowing', async () => {
      const res = await request(app)
        .patch(`/api/foreshadowing/${projectId}/nonexistent-id`)
        .send({ title: 'Does Not Matter' });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('should reject invalid status', async () => {
      const createRes = await request(app)
        .post(`/api/foreshadowing/${projectId}`)
        .send({ title: 'Test' });

      const res = await request(app)
        .patch(`/api/foreshadowing/${projectId}/${createRes.body.data.id}`)
        .send({ status: 'invalid' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject invalid importance', async () => {
      const createRes = await request(app)
        .post(`/api/foreshadowing/${projectId}`)
        .send({ title: 'Test' });

      const res = await request(app)
        .patch(`/api/foreshadowing/${projectId}/${createRes.body.data.id}`)
        .send({ importance: 'invalid' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('DELETE /api/foreshadowing/:projectId/:id', () => {
    it('should delete an existing foreshadowing', async () => {
      const createRes = await request(app)
        .post(`/api/foreshadowing/${projectId}`)
        .send({ title: 'To Delete' });

      const deleteRes = await request(app)
        .delete(`/api/foreshadowing/${projectId}/${createRes.body.data.id}`);

      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body.success).toBe(true);

      const listRes = await request(app)
        .get(`/api/foreshadowing/${projectId}`);
      expect(listRes.body.data).toHaveLength(0);
    });

    it('should return 404 for non-existent foreshadowing', async () => {
      const res = await request(app)
        .delete(`/api/foreshadowing/${projectId}/nonexistent-id`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe('Full CRUD workflow', () => {
    it('should create, read, update, and delete a foreshadowing', async () => {
      // Create
      const createRes = await request(app)
        .post(`/api/foreshadowing/${projectId}`)
        .send({ title: '神秘老人', description: '第一章出现', importance: 'important' });

      expect(createRes.status).toBe(201);
      const id = createRes.body.data.id;

      // Read list
      const listRes = await request(app)
        .get(`/api/foreshadowing/${projectId}`);

      expect(listRes.body.data).toHaveLength(1);
      expect(listRes.body.data[0].title).toBe('神秘老人');

      // Update
      const updateRes = await request(app)
        .patch(`/api/foreshadowing/${projectId}/${id}`)
        .send({ status: 'harvested', description: '已回收' });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.status).toBe('harvested');
      expect(updateRes.body.data.description).toBe('已回收');

      // Delete
      const deleteRes = await request(app)
        .delete(`/api/foreshadowing/${projectId}/${id}`);

      expect(deleteRes.status).toBe(200);

      // Verify deletion
      const goneRes = await request(app)
        .get(`/api/foreshadowing/${projectId}`);

      expect(goneRes.body.data).toHaveLength(0);
    });
  });
});