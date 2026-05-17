import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import Database from 'better-sqlite3';

let testDb: Database.Database;

function createTestDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL, avatar_color TEXT NOT NULL DEFAULT '#6366f1',
      created_at TEXT DEFAULT (datetime('now'))
    );
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
    CREATE TABLE writing_goals (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('daily','weekly','monthly','total')),
      target_words INTEGER NOT NULL,
      start_date TEXT,
      end_date TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
    CREATE TABLE chat_messages (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, chapter_id TEXT,
      role TEXT NOT NULL CHECK(role IN ('user','assistant','system')),
      content TEXT NOT NULL,
      skill_id TEXT DEFAULT '',
      token_usage INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
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

describe('Goals Routes', () => {
  let app: any;
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
      .send({ name: 'Goals Test Project', genre: 'fantasy', writing_mode: 'webnovel' });
    projectId = res.body.data.id;
  });

  afterEach(() => {
    vi.doUnmock('../../server/db/database.js');
    vi.doUnmock('../../server/ws/presenceManager.js');
    vi.doUnmock('../../server/services/analyticsService.js');
    vi.restoreAllMocks();
    if (testDb) testDb.close();
  });

  describe('GET /api/projects/:projectId/goals', () => {
    it('returns empty list for new project', async () => {
      const res = await request(app).get(`/api/projects/${projectId}/goals`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual([]);
    });
  });

  describe('POST /api/projects/:projectId/goals', () => {
    it('creates a daily goal', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/goals`)
        .send({ type: 'daily', target_words: 1000 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.type).toBe('daily');
      expect(res.body.data.target_words).toBe(1000);
      expect(res.body.data.is_active).toBe(1);
    });

    it('creates a total goal', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/goals`)
        .send({ type: 'total', target_words: 50000 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.type).toBe('total');
    });

    it('rejects invalid type', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/goals`)
        .send({ type: 'invalid', target_words: 1000 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('rejects zero target_words', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/goals`)
        .send({ type: 'daily', target_words: 0 });

      expect(res.status).toBe(400);
    });

    it('rejects negative target_words', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/goals`)
        .send({ type: 'daily', target_words: -100 });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/projects/:projectId/goals/:id', () => {
    it('returns a single goal', async () => {
      const createRes = await request(app)
        .post(`/api/projects/${projectId}/goals`)
        .send({ type: 'weekly', target_words: 5000 });
      const goalId = createRes.body.data.id;

      const res = await request(app).get(`/api/projects/${projectId}/goals/${goalId}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(goalId);
      expect(res.body.data.type).toBe('weekly');
    });

    it('returns 404 for non-existent goal', async () => {
      const res = await request(app).get(`/api/projects/${projectId}/goals/nonexistent`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/projects/:projectId/goals/:id/progress', () => {
    it('returns progress for a daily goal', async () => {
      const createRes = await request(app)
        .post(`/api/projects/${projectId}/goals`)
        .send({ type: 'daily', target_words: 1000 });
      const goalId = createRes.body.data.id;

      const res = await request(app).get(`/api/projects/${projectId}/goals/${goalId}/progress`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.percentage).toBe(0);
      expect(res.body.data.current_words).toBe(0);
    });

    it('returns 404 for non-existent goal', async () => {
      const res = await request(app).get(`/api/projects/${projectId}/goals/nonexistent/progress`);

      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/projects/:projectId/goals/:id', () => {
    it('updates a goal', async () => {
      const createRes = await request(app)
        .post(`/api/projects/${projectId}/goals`)
        .send({ type: 'daily', target_words: 1000 });
      const goalId = createRes.body.data.id;

      const res = await request(app)
        .put(`/api/projects/${projectId}/goals/${goalId}`)
        .send({ target_words: 2000 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.target_words).toBe(2000);
    });

    it('deactivates a goal', async () => {
      const createRes = await request(app)
        .post(`/api/projects/${projectId}/goals`)
        .send({ type: 'daily', target_words: 1000 });
      const goalId = createRes.body.data.id;

      const res = await request(app)
        .put(`/api/projects/${projectId}/goals/${goalId}`)
        .send({ is_active: 0 });

      expect(res.status).toBe(200);
      expect(res.body.data.is_active).toBe(0);
    });

    it('returns 404 for non-existent goal', async () => {
      const res = await request(app)
        .put(`/api/projects/${projectId}/goals/nonexistent`)
        .send({ target_words: 2000 });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/projects/:projectId/goals/:id', () => {
    it('deletes a goal', async () => {
      const createRes = await request(app)
        .post(`/api/projects/${projectId}/goals`)
        .send({ type: 'daily', target_words: 1000 });
      const goalId = createRes.body.data.id;

      const res = await request(app).delete(`/api/projects/${projectId}/goals/${goalId}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const listRes = await request(app).get(`/api/projects/${projectId}/goals`);
      expect(listRes.body.data).toHaveLength(0);
    });

    it('returns 404 for non-existent goal', async () => {
      const res = await request(app).delete(`/api/projects/${projectId}/goals/nonexistent`);

      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/projects/:projectId/goals (with progress)', () => {
    it('returns goals with computed progress', async () => {
      await request(app)
        .post(`/api/projects/${projectId}/goals`)
        .send({ type: 'daily', target_words: 1000 });

      const today = new Date().toISOString().slice(0, 10);
      testDb.prepare(
        "INSERT INTO daily_stats (id, project_id, date, words_added, words_total) VALUES (?, ?, ?, ?, ?)"
      ).run('stat-1', projectId, today, 500, 500);

      const res = await request(app).get(`/api/projects/${projectId}/goals`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].current_words).toBe(500);
      expect(res.body.data[0].percentage).toBe(50);
    });
  });
});
