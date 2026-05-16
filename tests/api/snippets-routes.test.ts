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
    CREATE INDEX IF NOT EXISTS idx_snippets_project ON snippet_templates(project_id, category, sort_order);
    CREATE INDEX IF NOT EXISTS idx_snippets_builtin ON snippet_templates(is_builtin);
  `);
  return db;
}

describe('Snippets API', () => {
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
      .send({ name: 'Snippet Test Project' });
    projectId = projRes.body.data.id;
  });

  afterEach(() => {
    vi.doUnmock('../../server/db/database.js');
    vi.doUnmock('../../server/ws/presenceManager.js');
    vi.doUnmock('../../server/services/analyticsService.js');
    vi.restoreAllMocks();
    if (testDb) testDb.close();
  });

  describe('GET /api/snippets/:projectId', () => {
    it('should return empty array when no snippets exist', async () => {
      const res = await request(app)
        .get(`/api/snippets/${projectId}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('should return project snippets and builtin snippets', async () => {
      await request(app)
        .post(`/api/snippets/${projectId}`)
        .send({ name: '自定义片段', content: '测试内容' });

      testDb.prepare(
        `INSERT INTO snippet_templates (project_id, name, category, content, is_builtin, sort_order, created_at)
         VALUES (NULL, '内置片段', 'fight', '内置内容', 1, 0, datetime('now'))`
      ).run();

      const res = await request(app)
        .get(`/api/snippets/${projectId}`);

      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThanOrEqual(2);
    });

    it('should filter by category', async () => {
      await request(app)
        .post(`/api/snippets/${projectId}`)
        .send({ name: '打斗片段', category: 'fight', content: '拳脚交锋' });

      await request(app)
        .post(`/api/snippets/${projectId}`)
        .send({ name: '环境片段', category: 'environment', content: '山川描写' });

      const res = await request(app)
        .get(`/api/snippets/${projectId}?category=fight`);

      expect(res.status).toBe(200);
      const fightItems = res.body.filter((s: any) => s.category === 'fight');
      expect(fightItems.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('POST /api/snippets/:projectId', () => {
    it('should create a custom snippet', async () => {
      const res = await request(app)
        .post(`/api/snippets/${projectId}`)
        .send({ name: '我的片段', content: '自定义内容' });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('我的片段');
      expect(res.body.content).toBe('自定义内容');
      expect(res.body.category).toBe('custom');
      expect(res.body.is_builtin).toBe(0);
    });

    it('should create with specific category', async () => {
      const res = await request(app)
        .post(`/api/snippets/${projectId}`)
        .send({ name: '打斗', category: 'fight', content: '拳脚' });

      expect(res.status).toBe(201);
      expect(res.body.category).toBe('fight');
    });

    it('should reject missing name', async () => {
      const res = await request(app)
        .post(`/api/snippets/${projectId}`)
        .send({ content: '内容' });

      expect(res.status).toBe(400);
    });

    it('should reject empty name', async () => {
      const res = await request(app)
        .post(`/api/snippets/${projectId}`)
        .send({ name: '', content: '内容' });

      expect(res.status).toBe(400);
    });

    it('should reject missing content', async () => {
      const res = await request(app)
        .post(`/api/snippets/${projectId}`)
        .send({ name: '名称' });

      expect(res.status).toBe(400);
    });

    it('should reject invalid category', async () => {
      const res = await request(app)
        .post(`/api/snippets/${projectId}`)
        .send({ name: '名称', category: 'invalid', content: '内容' });

      expect(res.status).toBe(400);
    });
  });

  describe('PATCH /api/snippets/:id', () => {
    it('should update a custom snippet', async () => {
      const createRes = await request(app)
        .post(`/api/snippets/${projectId}`)
        .send({ name: '原始', content: '原始内容' });
      const id = createRes.body.id;

      const res = await request(app)
        .patch(`/api/snippets/${projectId}/${id}`)
        .send({ name: '更新', content: '更新内容' });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('更新');
      expect(res.body.content).toBe('更新内容');
    });

    it('should reject editing builtin snippet', async () => {
      const info = testDb.prepare(
        `INSERT INTO snippet_templates (project_id, name, category, content, is_builtin, sort_order, created_at)
         VALUES (NULL, '内置', 'fight', '内容', 1, 0, datetime('now'))`
      ).run();
      const id = info.lastInsertRowid;

      const res = await request(app)
        .patch(`/api/snippets/${projectId}/${id}`)
        .send({ name: '修改内置' });

      expect(res.status).toBe(403);
    });

    it('should return 404 for non-existent snippet', async () => {
      const res = await request(app)
        .patch(`/api/snippets/${projectId}/99999`)
        .send({ name: '不存在' });

      expect(res.status).toBe(404);
    });

    it('should reject invalid id', async () => {
      const res = await request(app)
        .patch(`/api/snippets/${projectId}/abc`)
        .send({ name: '无效ID' });

      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /api/snippets/:id', () => {
    it('should delete a custom snippet', async () => {
      const createRes = await request(app)
        .post(`/api/snippets/${projectId}`)
        .send({ name: '待删除', content: '内容' });
      const id = createRes.body.id;

      const res = await request(app)
        .delete(`/api/snippets/${projectId}/${id}`);

      expect(res.status).toBe(200);
    });

    it('should reject deleting builtin snippet', async () => {
      const info = testDb.prepare(
        `INSERT INTO snippet_templates (project_id, name, category, content, is_builtin, sort_order, created_at)
         VALUES (NULL, '内置', 'fight', '内容', 1, 0, datetime('now'))`
      ).run();
      const id = info.lastInsertRowid;

      const res = await request(app)
        .delete(`/api/snippets/${projectId}/${id}`);

      expect(res.status).toBe(403);
    });

    it('should return 404 for non-existent snippet', async () => {
      const res = await request(app)
        .delete(`/api/snippets/${projectId}/99999`);

      expect(res.status).toBe(404);
    });

    it('should reject invalid id', async () => {
      const res = await request(app)
        .delete(`/api/snippets/${projectId}/abc`);

      expect(res.status).toBe(400);
    });
  });

  describe('Full CRUD workflow', () => {
    it('should create, read, update, and delete a snippet', async () => {
      // Create
      const createRes = await request(app)
        .post(`/api/snippets/${projectId}`)
        .send({ name: '测试片段', category: 'emotion', content: '心理描写' });

      expect(createRes.status).toBe(201);
      const id = createRes.body.id;

      // Read
      const listRes = await request(app)
        .get(`/api/snippets/${projectId}`);

      const created = listRes.body.find((s: any) => s.id === id);
      expect(created).toBeDefined();
      expect(created.name).toBe('测试片段');

      // Update
      const updateRes = await request(app)
        .patch(`/api/snippets/${projectId}/${id}`)
        .send({ name: '更新片段', content: '更新内容' });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.name).toBe('更新片段');

      // Delete
      const deleteRes = await request(app)
        .delete(`/api/snippets/${projectId}/${id}`);

      expect(deleteRes.status).toBe(200);

      // Verify deletion
      const goneRes = await request(app)
        .get(`/api/snippets/${projectId}`);

      const gone = goneRes.body.find((s: any) => s.id === id);
      expect(gone).toBeUndefined();
    });
  });
});