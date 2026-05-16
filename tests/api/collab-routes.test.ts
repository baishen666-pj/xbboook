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

describe('Collab Routes', () => {
  let app: any;
  let projectId: string;
  let userId: string;
  let userToken: string;
  let userId2: string;
  let user2Token: string;
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
    vi.doMock('../../server/services/analyticsService.js', () => ({
      getDashboardData: () => ({
        summary: { totalWords: 0, totalDays: 0, avgDaily: 0, bestDay: null },
        velocity: [], chapterStatus: [], streak: { current: 0, longest: 0 },
        target: { target: 0, current: 0, percentage: 0 },
        peakHours: Array.from({ length: 24 }, (_, h) => ({ hour: h, count: 0 })),
      }),
      getCharacterAppearances: async () => [],
    }));
    const mod = await import('../../server/app.js');
    app = mod.default;

    const projRes = await request(app)
      .post('/api/projects')
      .send({ name: 'Collab Test Project', genre: 'fantasy' });
    projectId = projRes.body.data.id;

    const user1Res = await request(app)
      .post('/api/users/identify')
      .send({ username: 'collab_owner', displayName: 'Owner' });
    userId = user1Res.body.data.id;
    userToken = user1Res.body.data.token;

    const user2Res = await request(app)
      .post('/api/users/identify')
      .send({ username: 'collab_writer', displayName: 'Writer' });
    userId2 = user2Res.body.data.id;
    user2Token = user2Res.body.data.token;

    const chRes = await request(app)
      .post(`/api/projects/${projectId}/chapters`)
      .send({ title: 'Collab Chapter' });
    chapterId = chRes.body.data.id;
  });

  afterEach(() => {
    vi.doUnmock('../../server/db/database.js');
    vi.doUnmock('../../server/ws/presenceManager.js');
    vi.doUnmock('../../server/services/analyticsService.js');
    vi.restoreAllMocks();
    if (testDb) testDb.close();
  });

  describe('POST /api/projects/:projectId/collab/members', () => {
    it('adds first member as owner', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/collab/members`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ userId });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.userId).toBe(userId);
    });

    it('adds subsequent members as writer by default', async () => {
      await request(app)
        .post(`/api/projects/${projectId}/collab/members`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ userId });

      const res = await request(app)
        .post(`/api/projects/${projectId}/collab/members`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ userId: userId2 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('rejects missing userId', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/collab/members`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('userId');
    });

    it('returns 404 for non-existent project', async () => {
      const res = await request(app)
        .post('/api/projects/nonexistent/collab/members')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ userId });

      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/projects/:projectId/collab/members', () => {
    it('returns members list', async () => {
      await request(app)
        .post(`/api/projects/${projectId}/collab/members`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ userId });

      const res = await request(app).get(`/api/projects/${projectId}/collab/members`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('returns empty array for project with no members', async () => {
      const res = await request(app).get(`/api/projects/${projectId}/collab/members`);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });
  });

  describe('DELETE /api/projects/:projectId/collab/members/:userId', () => {
    it('removes a member', async () => {
      await request(app)
        .post(`/api/projects/${projectId}/collab/members`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ userId });

      const res = await request(app)
        .delete(`/api/projects/${projectId}/collab/members/${userId}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const membersRes = await request(app).get(`/api/projects/${projectId}/collab/members`);
      const members = membersRes.body.data;
      expect(members.find((m: any) => m.user_id === userId)).toBeUndefined();
    });
  });

  describe('GET /api/projects/:projectId/collab/online', () => {
    it('returns online users list', async () => {
      const res = await request(app).get(`/api/projects/${projectId}/collab/online`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('POST /api/projects/:projectId/collab/lock/:chapterId', () => {
    it('acquires a lock', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/collab/lock/${chapterId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ userId });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.chapterId).toBe(chapterId);
      expect(res.body.data.userId).toBe(userId);
    });

    it('rejects missing userId', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/collab/lock/${chapterId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('userId');
    });

    it('returns 409 when another user holds the lock', async () => {
      await request(app)
        .post(`/api/projects/${projectId}/collab/lock/${chapterId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ userId });

      const res = await request(app)
        .post(`/api/projects/${projectId}/collab/lock/${chapterId}`)
        .set('Authorization', `Bearer ${user2Token}`)
        .send({ userId: userId2 });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('锁定');
    });

    it('allows same user to re-acquire (refresh)', async () => {
      await request(app)
        .post(`/api/projects/${projectId}/collab/lock/${chapterId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ userId });

      const res = await request(app)
        .post(`/api/projects/${projectId}/collab/lock/${chapterId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ userId });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('DELETE /api/projects/:projectId/collab/lock/:chapterId', () => {
    it('releases a lock', async () => {
      await request(app)
        .post(`/api/projects/${projectId}/collab/lock/${chapterId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ userId });

      const res = await request(app)
        .delete(`/api/projects/${projectId}/collab/lock/${chapterId}?userId=${userId}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('returns success without auth', async () => {
      const res = await request(app)
        .delete(`/api/projects/${projectId}/collab/lock/${chapterId}`);

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/projects/:projectId/collab/locks', () => {
    it('returns locks for project', async () => {
      await request(app)
        .post(`/api/projects/${projectId}/collab/lock/${chapterId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ userId });

      const res = await request(app).get(`/api/projects/${projectId}/collab/locks`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('returns empty array when no locks', async () => {
      const res = await request(app).get(`/api/projects/${projectId}/collab/locks`);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });
  });
});
