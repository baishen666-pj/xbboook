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
    CREATE TABLE writing_sessions (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, chapter_id TEXT NOT NULL,
      started_at TEXT NOT NULL, ended_at TEXT,
      words_start INTEGER DEFAULT 0, words_end INTEGER DEFAULT 0, duration_ms INTEGER DEFAULT 0,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
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
    CREATE TABLE chapter_versions (
      id TEXT PRIMARY KEY, chapter_id TEXT NOT NULL, project_id TEXT NOT NULL,
      version_number INTEGER NOT NULL, content_hash TEXT NOT NULL,
      word_count INTEGER DEFAULT 0, snapshot_type TEXT DEFAULT 'auto', label TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
    );
    CREATE TABLE outline_templates (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, genre TEXT NOT NULL, description TEXT,
      is_builtin INTEGER DEFAULT 0, source_project_id TEXT, structure TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
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
  `);
  return db;
}

describe('Worldviews API', () => {
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
      .send({ name: 'Worldview Test Project' });
    projectId = projRes.body.data.id;
  });

  afterEach(() => {
    vi.doUnmock('../../server/db/database.js');
    vi.doUnmock('../../server/ws/presenceManager.js');
    vi.doUnmock('../../server/services/analyticsService.js');
    vi.restoreAllMocks();
    if (testDb) testDb.close();
  });

  describe('POST /api/projects/:projectId/worldviews', () => {
    it('should create a worldview with required fields', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/worldviews`)
        .send({ category: 'geography', title: 'Mountain Range' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.category).toBe('geography');
      expect(res.body.data.title).toBe('Mountain Range');
      expect(res.body.data.content).toBeNull();
      expect(res.body.data.project_id).toBe(projectId);
      expect(res.body.data.sort_order).toBe(0);
    });

    it('should create a worldview with content', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/worldviews`)
        .send({ category: 'magic', title: 'Mana System', content: 'Mana flows through ley lines.' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.content).toBe('Mana flows through ley lines.');
    });

    it('should auto-increment sort_order for subsequent worldviews', async () => {
      const first = await request(app)
        .post(`/api/projects/${projectId}/worldviews`)
        .send({ category: 'history', title: 'First' });

      const second = await request(app)
        .post(`/api/projects/${projectId}/worldviews`)
        .send({ category: 'history', title: 'Second' });

      expect(first.body.data.sort_order).toBe(0);
      expect(second.body.data.sort_order).toBe(1);
    });

    it('should reject missing category', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/worldviews`)
        .send({ title: 'No Category' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject missing title', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/worldviews`)
        .send({ category: 'test' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject empty category', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/worldviews`)
        .send({ category: '', title: 'Empty Category' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject empty title', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/worldviews`)
        .send({ category: 'test', title: '' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject category exceeding 100 characters', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/worldviews`)
        .send({ category: 'x'.repeat(101), title: 'Valid Title' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject title exceeding 200 characters', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/worldviews`)
        .send({ category: 'test', title: 'x'.repeat(201) });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject content exceeding 50000 characters', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/worldviews`)
        .send({ category: 'test', title: 'Valid', content: 'x'.repeat(50001) });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should accept content at exactly 50000 characters', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/worldviews`)
        .send({ category: 'test', title: 'Max Content', content: 'x'.repeat(50000) });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('should accept category at exactly 100 characters', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/worldviews`)
        .send({ category: 'x'.repeat(100), title: 'Max Category' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('should accept title at exactly 200 characters', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/worldviews`)
        .send({ category: 'test', title: 'x'.repeat(200) });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('should reject non-string category', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/worldviews`)
        .send({ category: 123, title: 'Numeric Category' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject non-string title', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/worldviews`)
        .send({ category: 'test', title: 42 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/projects/:projectId/worldviews', () => {
    it('should return empty items and categories when no worldviews exist', async () => {
      const res = await request(app)
        .get(`/api/projects/${projectId}/worldviews`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items).toEqual([]);
      expect(res.body.data.categories).toEqual([]);
    });

    it('should list all worldviews with categories', async () => {
      await request(app)
        .post(`/api/projects/${projectId}/worldviews`)
        .send({ category: 'geography', title: 'Mountains' });
      await request(app)
        .post(`/api/projects/${projectId}/worldviews`)
        .send({ category: 'magic', title: 'Spells' });
      await request(app)
        .post(`/api/projects/${projectId}/worldviews`)
        .send({ category: 'geography', title: 'Rivers' });

      const res = await request(app)
        .get(`/api/projects/${projectId}/worldviews`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items).toHaveLength(3);
      expect(res.body.data.categories).toEqual(['geography', 'magic']);
    });

    it('should filter worldviews by category', async () => {
      await request(app)
        .post(`/api/projects/${projectId}/worldviews`)
        .send({ category: 'geography', title: 'Mountains' });
      await request(app)
        .post(`/api/projects/${projectId}/worldviews`)
        .send({ category: 'magic', title: 'Spells' });
      await request(app)
        .post(`/api/projects/${projectId}/worldviews`)
        .send({ category: 'geography', title: 'Rivers' });

      const res = await request(app)
        .get(`/api/projects/${projectId}/worldviews?category=geography`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data.every((w: any) => w.category === 'geography')).toBe(true);
    });

    it('should return empty array when filtering by non-existent category', async () => {
      await request(app)
        .post(`/api/projects/${projectId}/worldviews`)
        .send({ category: 'geography', title: 'Mountains' });

      const res = await request(app)
        .get(`/api/projects/${projectId}/worldviews?category=nonexistent`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual([]);
    });

    it('should only return worldviews for the specified project', async () => {
      const projectBRes = await request(app)
        .post('/api/projects')
        .send({ name: 'Other Project' });
      const projectB = projectBRes.body.data.id;

      await request(app)
        .post(`/api/projects/${projectId}/worldviews`)
        .send({ category: 'test', title: 'A Only' });
      await request(app)
        .post(`/api/projects/${projectB}/worldviews`)
        .send({ category: 'test', title: 'B Only' });

      const resA = await request(app).get(`/api/projects/${projectId}/worldviews`);
      const resB = await request(app).get(`/api/projects/${projectB}/worldviews`);

      expect(resA.body.data.items).toHaveLength(1);
      expect(resA.body.data.items[0].title).toBe('A Only');
      expect(resB.body.data.items).toHaveLength(1);
      expect(resB.body.data.items[0].title).toBe('B Only');
    });
  });

  describe('GET /api/projects/:projectId/worldviews/categories', () => {
    it('should return empty array when no worldviews exist', async () => {
      const res = await request(app)
        .get(`/api/projects/${projectId}/worldviews/categories`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual([]);
    });

    it('should return distinct categories sorted alphabetically', async () => {
      await request(app)
        .post(`/api/projects/${projectId}/worldviews`)
        .send({ category: 'magic', title: 'Item A' });
      await request(app)
        .post(`/api/projects/${projectId}/worldviews`)
        .send({ category: 'geography', title: 'Item B' });
      await request(app)
        .post(`/api/projects/${projectId}/worldviews`)
        .send({ category: 'magic', title: 'Item C' });

      const res = await request(app)
        .get(`/api/projects/${projectId}/worldviews/categories`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(['geography', 'magic']);
    });

    it('should not include categories from other projects', async () => {
      const projectBRes = await request(app)
        .post('/api/projects')
        .send({ name: 'Other Project' });
      const projectB = projectBRes.body.data.id;

      await request(app)
        .post(`/api/projects/${projectId}/worldviews`)
        .send({ category: 'alpha', title: 'A' });
      await request(app)
        .post(`/api/projects/${projectB}/worldviews`)
        .send({ category: 'beta', title: 'B' });

      const res = await request(app)
        .get(`/api/projects/${projectId}/worldviews/categories`);

      expect(res.body.data).toEqual(['alpha']);
    });
  });

  describe('GET /api/projects/:projectId/worldviews/:id', () => {
    it('should return a single worldview by id', async () => {
      const createRes = await request(app)
        .post(`/api/projects/${projectId}/worldviews`)
        .send({ category: 'history', title: 'Founding War', content: 'A long time ago...' });

      const res = await request(app)
        .get(`/api/projects/${projectId}/worldviews/${createRes.body.data.id}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(createRes.body.data.id);
      expect(res.body.data.category).toBe('history');
      expect(res.body.data.title).toBe('Founding War');
      expect(res.body.data.content).toBe('A long time ago...');
    });

    it('should return 404 for non-existent worldview', async () => {
      const res = await request(app)
        .get(`/api/projects/${projectId}/worldviews/nonexistent-id`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe('PUT /api/projects/:projectId/worldviews/:id', () => {
    it('should update title', async () => {
      const createRes = await request(app)
        .post(`/api/projects/${projectId}/worldviews`)
        .send({ category: 'test', title: 'Original' });

      const res = await request(app)
        .put(`/api/projects/${projectId}/worldviews/${createRes.body.data.id}`)
        .send({ title: 'Updated' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('Updated');
      expect(res.body.data.category).toBe('test');
    });

    it('should update category', async () => {
      const createRes = await request(app)
        .post(`/api/projects/${projectId}/worldviews`)
        .send({ category: 'old-cat', title: 'Item' });

      const res = await request(app)
        .put(`/api/projects/${projectId}/worldviews/${createRes.body.data.id}`)
        .send({ category: 'new-cat' });

      expect(res.status).toBe(200);
      expect(res.body.data.category).toBe('new-cat');
    });

    it('should update content', async () => {
      const createRes = await request(app)
        .post(`/api/projects/${projectId}/worldviews`)
        .send({ category: 'test', title: 'Item', content: 'Original content' });

      const res = await request(app)
        .put(`/api/projects/${projectId}/worldviews/${createRes.body.data.id}`)
        .send({ content: 'New content' });

      expect(res.status).toBe(200);
      expect(res.body.data.content).toBe('New content');
    });

    it('should update sort_order', async () => {
      const createRes = await request(app)
        .post(`/api/projects/${projectId}/worldviews`)
        .send({ category: 'test', title: 'Item' });

      const res = await request(app)
        .put(`/api/projects/${projectId}/worldviews/${createRes.body.data.id}`)
        .send({ sort_order: 5 });

      expect(res.status).toBe(200);
      expect(res.body.data.sort_order).toBe(5);
    });

    it('should update multiple fields at once', async () => {
      const createRes = await request(app)
        .post(`/api/projects/${projectId}/worldviews`)
        .send({ category: 'old', title: 'Old Title' });

      const res = await request(app)
        .put(`/api/projects/${projectId}/worldviews/${createRes.body.data.id}`)
        .send({ category: 'new', title: 'New Title', content: 'Added content', sort_order: 10 });

      expect(res.status).toBe(200);
      expect(res.body.data.category).toBe('new');
      expect(res.body.data.title).toBe('New Title');
      expect(res.body.data.content).toBe('Added content');
      expect(res.body.data.sort_order).toBe(10);
    });

    it('should return existing item when body is empty', async () => {
      const createRes = await request(app)
        .post(`/api/projects/${projectId}/worldviews`)
        .send({ category: 'test', title: 'Unchanged' });

      const res = await request(app)
        .put(`/api/projects/${projectId}/worldviews/${createRes.body.data.id}`)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.data.title).toBe('Unchanged');
    });

    it('should return 404 for non-existent worldview', async () => {
      const res = await request(app)
        .put(`/api/projects/${projectId}/worldviews/nonexistent-id`)
        .send({ title: 'Does Not Matter' });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('should reject empty category on update', async () => {
      const createRes = await request(app)
        .post(`/api/projects/${projectId}/worldviews`)
        .send({ category: 'test', title: 'Item' });

      const res = await request(app)
        .put(`/api/projects/${projectId}/worldviews/${createRes.body.data.id}`)
        .send({ category: '' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject empty title on update', async () => {
      const createRes = await request(app)
        .post(`/api/projects/${projectId}/worldviews`)
        .send({ category: 'test', title: 'Item' });

      const res = await request(app)
        .put(`/api/projects/${projectId}/worldviews/${createRes.body.data.id}`)
        .send({ title: '' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject category exceeding 100 characters on update', async () => {
      const createRes = await request(app)
        .post(`/api/projects/${projectId}/worldviews`)
        .send({ category: 'test', title: 'Item' });

      const res = await request(app)
        .put(`/api/projects/${projectId}/worldviews/${createRes.body.data.id}`)
        .send({ category: 'x'.repeat(101) });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject title exceeding 200 characters on update', async () => {
      const createRes = await request(app)
        .post(`/api/projects/${projectId}/worldviews`)
        .send({ category: 'test', title: 'Item' });

      const res = await request(app)
        .put(`/api/projects/${projectId}/worldviews/${createRes.body.data.id}`)
        .send({ title: 'x'.repeat(201) });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject content exceeding 50000 characters on update', async () => {
      const createRes = await request(app)
        .post(`/api/projects/${projectId}/worldviews`)
        .send({ category: 'test', title: 'Item' });

      const res = await request(app)
        .put(`/api/projects/${projectId}/worldviews/${createRes.body.data.id}`)
        .send({ content: 'x'.repeat(50001) });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject negative sort_order', async () => {
      const createRes = await request(app)
        .post(`/api/projects/${projectId}/worldviews`)
        .send({ category: 'test', title: 'Item' });

      const res = await request(app)
        .put(`/api/projects/${projectId}/worldviews/${createRes.body.data.id}`)
        .send({ sort_order: -1 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject non-integer sort_order', async () => {
      const createRes = await request(app)
        .post(`/api/projects/${projectId}/worldviews`)
        .send({ category: 'test', title: 'Item' });

      const res = await request(app)
        .put(`/api/projects/${projectId}/worldviews/${createRes.body.data.id}`)
        .send({ sort_order: 1.5 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should accept sort_order of 0', async () => {
      const createRes = await request(app)
        .post(`/api/projects/${projectId}/worldviews`)
        .send({ category: 'test', title: 'Item' });

      const res = await request(app)
        .put(`/api/projects/${projectId}/worldviews/${createRes.body.data.id}`)
        .send({ sort_order: 0 });

      expect(res.status).toBe(200);
      expect(res.body.data.sort_order).toBe(0);
    });
  });

  describe('DELETE /api/projects/:projectId/worldviews/:id', () => {
    it('should delete an existing worldview', async () => {
      const createRes = await request(app)
        .post(`/api/projects/${projectId}/worldviews`)
        .send({ category: 'test', title: 'To Delete' });

      const deleteRes = await request(app)
        .delete(`/api/projects/${projectId}/worldviews/${createRes.body.data.id}`);

      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body.success).toBe(true);

      const listRes = await request(app)
        .get(`/api/projects/${projectId}/worldviews`);
      expect(listRes.body.data.items).toHaveLength(0);
    });

    it('should return 404 for non-existent worldview', async () => {
      const res = await request(app)
        .delete(`/api/projects/${projectId}/worldviews/nonexistent-id`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('should remove category from list when last item in that category is deleted', async () => {
      const cat1 = await request(app)
        .post(`/api/projects/${projectId}/worldviews`)
        .send({ category: 'unique-cat', title: 'Only One' });

      await request(app)
        .post(`/api/projects/${projectId}/worldviews`)
        .send({ category: 'other-cat', title: 'Other' });

      const catsBefore = await request(app)
        .get(`/api/projects/${projectId}/worldviews/categories`);
      expect(catsBefore.body.data).toContain('unique-cat');

      await request(app)
        .delete(`/api/projects/${projectId}/worldviews/${cat1.body.data.id}`);

      const catsAfter = await request(app)
        .get(`/api/projects/${projectId}/worldviews/categories`);
      expect(catsAfter.body.data).not.toContain('unique-cat');
      expect(catsAfter.body.data).toContain('other-cat');
    });
  });

  describe('Full CRUD workflow', () => {
    it('should create, read, update, and delete a worldview', async () => {
      // Create
      const createRes = await request(app)
        .post(`/api/projects/${projectId}/worldviews`)
        .send({ category: 'culture', title: 'Elven Traditions', content: 'The elves revere the moon.' });

      expect(createRes.status).toBe(201);
      const wvId = createRes.body.data.id;

      // Read single
      const getRes = await request(app)
        .get(`/api/projects/${projectId}/worldviews/${wvId}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body.data.title).toBe('Elven Traditions');

      // Read list
      const listRes = await request(app)
        .get(`/api/projects/${projectId}/worldviews`);

      expect(listRes.body.data.items).toHaveLength(1);
      expect(listRes.body.data.categories).toEqual(['culture']);

      // Update
      const updateRes = await request(app)
        .put(`/api/projects/${projectId}/worldviews/${wvId}`)
        .send({ title: 'Elven Moon Traditions', content: 'Updated content' });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.title).toBe('Elven Moon Traditions');
      expect(updateRes.body.data.content).toBe('Updated content');

      // Verify update via GET
      const verifyRes = await request(app)
        .get(`/api/projects/${projectId}/worldviews/${wvId}`);

      expect(verifyRes.body.data.title).toBe('Elven Moon Traditions');

      // Delete
      const deleteRes = await request(app)
        .delete(`/api/projects/${projectId}/worldviews/${wvId}`);

      expect(deleteRes.status).toBe(200);

      // Verify deletion
      const goneRes = await request(app)
        .get(`/api/projects/${projectId}/worldviews/${wvId}`);

      expect(goneRes.status).toBe(404);
    });
  });

  describe('Ordering behavior', () => {
    it('should return worldviews ordered by category then sort_order', async () => {
      await request(app)
        .post(`/api/projects/${projectId}/worldviews`)
        .send({ category: 'beta', title: 'Beta First' });
      await request(app)
        .post(`/api/projects/${projectId}/worldviews`)
        .send({ category: 'alpha', title: 'Alpha First' });
      await request(app)
        .post(`/api/projects/${projectId}/worldviews`)
        .send({ category: 'alpha', title: 'Alpha Second' });

      const res = await request(app)
        .get(`/api/projects/${projectId}/worldviews`);

      const items = res.body.data.items;
      expect(items[0].category).toBe('alpha');
      expect(items[0].title).toBe('Alpha First');
      expect(items[1].category).toBe('alpha');
      expect(items[1].title).toBe('Alpha Second');
      expect(items[2].category).toBe('beta');
      expect(items[2].title).toBe('Beta First');
    });

    it('should respect updated sort_order in listing', async () => {
      const a = await request(app)
        .post(`/api/projects/${projectId}/worldviews`)
        .send({ category: 'test', title: 'A' });
      const b = await request(app)
        .post(`/api/projects/${projectId}/worldviews`)
        .send({ category: 'test', title: 'B' });

      await request(app)
        .put(`/api/projects/${projectId}/worldviews/${a.body.data.id}`)
        .send({ sort_order: 10 });
      await request(app)
        .put(`/api/projects/${projectId}/worldviews/${b.body.data.id}`)
        .send({ sort_order: 0 });

      const res = await request(app)
        .get(`/api/projects/${projectId}/worldviews?category=test`);

      expect(res.body.data[0].title).toBe('B');
      expect(res.body.data[1].title).toBe('A');
    });
  });
});
