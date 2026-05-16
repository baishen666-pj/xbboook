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
    CREATE TABLE characters (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, name TEXT NOT NULL, nickname TEXT,
      role_type TEXT DEFAULT 'supporting', gender TEXT, age TEXT, appearance TEXT,
      personality TEXT, background TEXT, abilities TEXT, notes TEXT,
      sort_order INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
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

describe('Stats Routes', () => {
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
      const { getDb } = await import('../../server/db/database.js');
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
      .send({ name: 'Stats Test Project', genre: 'fantasy', writing_mode: 'webnovel' });
    projectId = res.body.data.id;
  });

  afterEach(() => {
    vi.doUnmock('../../server/db/database.js');
    vi.doUnmock('../../server/ws/presenceManager.js');
    vi.doUnmock('../../server/services/analyticsService.js');
    vi.restoreAllMocks();
    if (testDb) testDb.close();
  });

  describe('GET /api/projects/:projectId/stats', () => {
    it('returns summary and recent stats', async () => {
      const res = await request(app).get(`/api/projects/${projectId}/stats`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.summary).toBeDefined();
      expect(res.body.data.recent).toBeDefined();
      expect(res.body.data.summary.totalWords).toBe(0);
    });
  });

  describe('GET /api/projects/:projectId/stats/dashboard', () => {
    it('returns dashboard data', async () => {
      const res = await request(app).get(`/api/projects/${projectId}/stats/dashboard`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.summary).toBeDefined();
      expect(res.body.data.velocity).toBeDefined();
      expect(res.body.data.chapterStatus).toBeDefined();
      expect(res.body.data.streak).toBeDefined();
      expect(res.body.data.target).toBeDefined();
      expect(res.body.data.peakHours).toBeDefined();
      expect(res.body.data.peakHours).toHaveLength(24);
    });

    it('respects days query parameter', async () => {
      const res = await request(app).get(`/api/projects/${projectId}/stats/dashboard?days=7`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('clamps days parameter between 1 and 365', async () => {
      const res = await request(app).get(`/api/projects/${projectId}/stats/dashboard?days=0`);
      expect(res.status).toBe(200);

      const resLarge = await request(app).get(`/api/projects/${projectId}/stats/dashboard?days=999`);
      expect(resLarge.status).toBe(200);
    });
  });

  describe('GET /api/projects/:projectId/stats/characters', () => {
    it('returns empty array for project with no characters', async () => {
      const res = await request(app).get(`/api/projects/${projectId}/stats/characters`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual([]);
    });
  });

  describe('POST /api/projects/:projectId/stats', () => {
    it('creates a daily stat', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/stats`)
        .send({ date: '2026-01-15', wordsAdded: 500, wordsTotal: 5000, writingTimeMs: 1800000, chaptersWorked: 2 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.words_added).toBe(500);
    });

    it('rejects invalid date format', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/stats`)
        .send({ date: 'not-a-date', wordsAdded: 500 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('rejects negative wordsAdded', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/stats`)
        .send({ date: '2026-01-15', wordsAdded: -10 });

      expect(res.status).toBe(400);
    });

    it('increments existing stat on same date', async () => {
      await request(app)
        .post(`/api/projects/${projectId}/stats`)
        .send({ date: '2026-01-15', wordsAdded: 200, wordsTotal: 5000 });

      const res = await request(app)
        .post(`/api/projects/${projectId}/stats`)
        .send({ date: '2026-01-15', wordsAdded: 300, wordsTotal: 5300 });

      expect(res.status).toBe(200);
      expect(res.body.data.words_added).toBe(500);
    });
  });

  describe('POST /api/projects/:projectId/stats/session', () => {
    let chapterId: string;

    beforeEach(async () => {
      const chRes = await request(app)
        .post(`/api/projects/${projectId}/chapters`)
        .send({ title: 'Session Chapter' });
      chapterId = chRes.body.data.id;
    });

    it('starts a writing session', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/stats/session`)
        .send({ chapterId, wordsStart: 100 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.chapter_id).toBe(chapterId);
      expect(res.body.data.words_start).toBe(100);
      expect(res.body.data.ended_at).toBeNull();
    });

    it('rejects missing chapterId', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/stats/session`)
        .send({ wordsStart: 100 });

      expect(res.status).toBe(400);
    });

    it('rejects negative wordsStart', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/stats/session`)
        .send({ chapterId, wordsStart: -5 });

      expect(res.status).toBe(400);
    });
  });

  describe('PUT /api/projects/:projectId/stats/session/:sessionId', () => {
    let chapterId: string;
    let sessionId: string;

    beforeEach(async () => {
      const chRes = await request(app)
        .post(`/api/projects/${projectId}/chapters`)
        .send({ title: 'Session Chapter' });
      chapterId = chRes.body.data.id;

      const sessRes = await request(app)
        .post(`/api/projects/${projectId}/stats/session`)
        .send({ chapterId, wordsStart: 100 });
      sessionId = sessRes.body.data.id;
    });

    it('ends a writing session', async () => {
      const res = await request(app)
        .put(`/api/projects/${projectId}/stats/session/${sessionId}`)
        .send({ wordsEnd: 350 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.words_end).toBe(350);
      expect(res.body.data.ended_at).not.toBeNull();
      expect(res.body.data.duration_ms).toBeGreaterThanOrEqual(0);
    });

    it('returns 404 for non-existent session', async () => {
      const res = await request(app)
        .put(`/api/projects/${projectId}/stats/session/nonexistent`)
        .send({ wordsEnd: 100 });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('rejects negative wordsEnd', async () => {
      const res = await request(app)
        .put(`/api/projects/${projectId}/stats/session/${sessionId}`)
        .send({ wordsEnd: -10 });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/projects/:projectId/stats/recent', () => {
    it('returns recent stats', async () => {
      const res = await request(app).get(`/api/projects/${projectId}/stats/recent?days=7`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });
});
