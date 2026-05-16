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
    CREATE TABLE project_members (
      project_id TEXT NOT NULL, user_id TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'writer', joined_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (project_id, user_id),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE chapter_locks (
      chapter_id TEXT PRIMARY KEY, user_id TEXT NOT NULL,
      locked_at TEXT DEFAULT (datetime('now')), expires_at TEXT
    );
  `);
  return db;
}

describe('Users Routes', () => {
  let app: Awaited<ReturnType<typeof import('../../server/app.js').default>>;

  beforeEach(async () => {
    testDb = createTestDb();
    vi.doMock('../../server/db/database.js', () => ({
      getDb: () => testDb,
      closeDb: () => {},
    }));
    vi.doMock('../../server/ws/presenceManager.js', () => ({
      generateToken: (userId: string) => `test-token-${userId}`,
      validateToken: (token: string) => {
        const match = token.match(/^test-token-(.+)$/);
        return match ? match[1] : null;
      },
      addConnection: vi.fn(),
      removeConnection: vi.fn(),
      getOnlineUsers: () => [],
      broadcastToProject: vi.fn(),
    }));
    const mod = await import('../../server/app.js');
    app = mod.default;
  });

  afterEach(() => {
    vi.doUnmock('../../server/db/database.js');
    vi.doUnmock('../../server/ws/presenceManager.js');
    vi.restoreAllMocks();
    if (testDb) testDb.close();
  });

  describe('POST /api/users/identify', () => {
    it('creates a new user', async () => {
      const res = await request(app)
        .post('/api/users/identify')
        .send({ username: 'testuser_new_001', displayName: 'Test User 001' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.username).toBe('testuser_new_001');
      expect(res.body.data.display_name).toBe('Test User 001');
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.avatar_color).toBeDefined();
    });

    it('returns existing user on duplicate username', async () => {
      await request(app)
        .post('/api/users/identify')
        .send({ username: 'dup_user_002', displayName: 'Original' });

      const res = await request(app)
        .post('/api/users/identify')
        .send({ username: 'dup_user_002', displayName: 'Duplicate' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.display_name).toBe('Original');
    });

    it('accepts custom avatarColor', async () => {
      const res = await request(app)
        .post('/api/users/identify')
        .send({ username: 'color_user_003', displayName: 'Color User', avatarColor: '#ec4899' });

      expect(res.status).toBe(200);
      expect(res.body.data.avatar_color).toBe('#ec4899');
    });

    it('rejects empty username', async () => {
      const res = await request(app)
        .post('/api/users/identify')
        .send({ username: '', displayName: 'No Name' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('rejects missing displayName', async () => {
      const res = await request(app)
        .post('/api/users/identify')
        .send({ username: 'nodisplay' });

      expect(res.status).toBe(400);
    });

    it('rejects invalid avatarColor format', async () => {
      const res = await request(app)
        .post('/api/users/identify')
        .send({ username: 'badcolor_004', displayName: 'Bad Color', avatarColor: 'not-a-color' });

      expect(res.status).toBe(400);
    });

    it('rejects username exceeding 20 chars', async () => {
      const res = await request(app)
        .post('/api/users/identify')
        .send({ username: 'a'.repeat(21), displayName: 'Long Name' });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/users/me', () => {
    it('returns user by userId', async () => {
      const createRes = await request(app)
        .post('/api/users/identify')
        .send({ username: 'me_user_005', displayName: 'Me User' });
      const userId = createRes.body.data.id;

      const res = await request(app).get(`/api/users/me?userId=${userId}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(userId);
      expect(res.body.data.username).toBe('me_user_005');
    });

    it('returns 400 when userId is missing', async () => {
      const res = await request(app).get('/api/users/me');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBeDefined();
    });

    it('returns 404 for non-existent user', async () => {
      const res = await request(app).get('/api/users/me?userId=nonexistent');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/users', () => {
    it('returns all users', async () => {
      await request(app)
        .post('/api/users/identify')
        .send({ username: 'list_user_006', displayName: 'List User 1' });

      const res = await request(app).get('/api/users');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });
  });
});
