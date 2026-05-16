import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';

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
    CREATE TABLE character_relations (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, character_a_id TEXT NOT NULL,
      character_b_id TEXT NOT NULL, relation_type TEXT NOT NULL, description TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (character_a_id) REFERENCES characters(id) ON DELETE CASCADE,
      FOREIGN KEY (character_b_id) REFERENCES characters(id) ON DELETE CASCADE
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

function seedCommentDirectly(
  db: Database.Database,
  data: {
    chapterId: string;
    projectId: string;
    userId: string;
    content: string;
    selectionFrom?: number;
    selectionTo?: number;
    selectionText?: string;
  },
): string {
  const id = randomUUID();
  db.prepare(`
    INSERT INTO chapter_comments (id, chapter_id, project_id, user_id, content, selection_from, selection_to, selection_text)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    data.chapterId,
    data.projectId,
    data.userId,
    data.content,
    data.selectionFrom ?? null,
    data.selectionTo ?? null,
    data.selectionText ?? null,
  );
  return id;
}

describe('Comments Routes', () => {
  let projectId: string;
  let chapterId: string;
  let userId: string;

  beforeEach(async () => {
    testDb = createTestDb();
    vi.doMock('../../server/db/database.js', () => ({ getDb: () => testDb, closeDb: () => {} }));
    vi.doMock('../../server/ws/presenceManager.js', () => ({
      generateToken: (uid: string) => `test-token-${uid}`,
      validateToken: (token: string) => { const m = token.match(/^test-token-(.+)$/); return m ? m[1] : null; },
      addConnection: vi.fn(), removeConnection: vi.fn(), getOnlineUsers: () => [], broadcastToProject: vi.fn(),
    }));
    vi.doMock('../../server/services/analyticsService.js', () => ({
      getDashboardData: () => ({ summary: { totalWords: 0, totalDays: 0, avgDaily: 0, bestDay: null }, velocity: [], chapterStatus: [], streak: { current: 0, longest: 0 }, target: { target: 0, current: 0, percentage: 0 }, peakHours: Array.from({ length: 24 }, (_, h) => ({ hour: h, count: 0 })) }),
      getCharacterAppearances: async () => [],
    }));
    vi.doMock('../../server/services/fileService.js', () => ({
      readChapter: vi.fn().mockResolvedValue(''),
      writeChapter: vi.fn(),
      writeVersion: vi.fn(),
      readVersion: vi.fn().mockResolvedValue(''),
      deleteVersionFile: vi.fn(),
      deleteVersionDir: vi.fn(),
      ensureProjectDir: vi.fn(),
      deleteProjectDir: vi.fn(),
      deleteChapter: vi.fn(),
    }));
    // The comments route reads userId from req.body after validate() runs,
    // but the Zod createSchema does not include userId so it gets stripped.
    // Override validate to use passthrough so userId survives.
    vi.doMock('../../server/middleware/validate.js', () => {
      const { ZodSchema, ZodError } = require('zod');
      return {
        validate: (schema: any) => (req: any, res: any, next: any) => {
          try {
            const result = schema.safeParse(req.body);
            if (!result.success) {
              const issues = result.error.issues ?? result.error.errors;
              const message = issues.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(', ');
              res.status(400).json({ success: false, error: message });
              return;
            }
            // Merge validated data with original body to preserve extra fields like userId
            req.body = { ...req.body, ...result.data };
            next();
          } catch (err) {
            next(err);
          }
        },
      };
    });
    const mod = await import('../../server/app.js');
    app = mod.default;

    // Seed a project
    const projRes = await request(app)
      .post('/api/projects')
      .send({ name: 'Comment Test Project' });
    projectId = projRes.body.data.id;

    // Seed a chapter
    const chRes = await request(app)
      .post(`/api/projects/${projectId}/chapters`)
      .send({ title: 'Comment Chapter' });
    chapterId = chRes.body.data.id;

    // Seed a user directly into DB
    userId = randomUUID();
    testDb.prepare(
      'INSERT INTO users (id, username, display_name, avatar_color) VALUES (?, ?, ?, ?)',
    ).run(userId, 'commenter', 'Commenter User', '#10b981');
  });

  afterEach(() => {
    vi.doUnmock('../../server/db/database.js');
    vi.doUnmock('../../server/ws/presenceManager.js');
    vi.doUnmock('../../server/services/analyticsService.js');
    vi.doUnmock('../../server/services/fileService.js');
    vi.doUnmock('../../server/middleware/validate.js');
    vi.restoreAllMocks();
    if (testDb) testDb.close();
  });

  describe('GET /api/projects/:projectId/chapters/:chapterId/comments', () => {
    it('returns empty array when no comments exist', async () => {
      const res = await request(app)
        .get(`/api/projects/${projectId}/chapters/${chapterId}/comments`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual([]);
    });

    it('returns comments with displayName', async () => {
      seedCommentDirectly(testDb, {
        chapterId,
        projectId,
        userId,
        content: 'Nice paragraph',
      });

      const res = await request(app)
        .get(`/api/projects/${projectId}/chapters/${chapterId}/comments`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].content).toBe('Nice paragraph');
      expect(res.body.data[0].displayName).toBe('Commenter User');
    });
  });

  describe('POST /api/projects/:projectId/chapters/:chapterId/comments', () => {
    it('creates a comment successfully', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/chapters/${chapterId}/comments`)
        .set('Authorization', `Bearer test-token-${userId}`)
        .send({ content: 'This needs revision' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.content).toBe('This needs revision');
      expect(res.body.data.displayName).toBe('Commenter User');
    });

    it('creates a comment with selection', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/chapters/${chapterId}/comments`)
        .set('Authorization', `Bearer test-token-${userId}`)
        .send({
          content: 'Check this',
          selectionFrom: 10,
          selectionTo: 50,
          selectionText: 'selected text here',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.selection_from).toBe(10);
      expect(res.body.data.selection_to).toBe(50);
      expect(res.body.data.selection_text).toBe('selected text here');
    });

    it('rejects empty content', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/chapters/${chapterId}/comments`)
        .set('Authorization', `Bearer test-token-${userId}`)
        .send({ content: '' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('rejects without authentication', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/chapters/${chapterId}/comments`)
        .send({ content: 'No auth' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe('PUT /api/projects/:projectId/chapters/:chapterId/comments/:commentId', () => {
    it('updates comment content', async () => {
      const commentId = seedCommentDirectly(testDb, {
        chapterId,
        projectId,
        userId,
        content: 'Original',
      });

      const res = await request(app)
        .put(`/api/projects/${projectId}/chapters/${chapterId}/comments/${commentId}`)
        .send({ content: 'Updated content' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.content).toBe('Updated content');
    });

    it('returns 404 for non-existent comment', async () => {
      const res = await request(app)
        .put(`/api/projects/${projectId}/chapters/${chapterId}/comments/nonexistent`)
        .send({ content: 'Nope' });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe('PUT /api/projects/:projectId/chapters/:chapterId/comments/:commentId/resolve', () => {
    it('resolves a comment', async () => {
      const commentId = seedCommentDirectly(testDb, {
        chapterId,
        projectId,
        userId,
        content: 'Resolve me',
      });

      const res = await request(app)
        .put(`/api/projects/${projectId}/chapters/${chapterId}/comments/${commentId}/resolve`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.resolved).toBe(1);
    });

    it('returns 404 for non-existent comment', async () => {
      const res = await request(app)
        .put(`/api/projects/${projectId}/chapters/${chapterId}/comments/nonexistent/resolve`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe('DELETE /api/projects/:projectId/chapters/:chapterId/comments/:commentId', () => {
    it('deletes a comment', async () => {
      const commentId = seedCommentDirectly(testDb, {
        chapterId,
        projectId,
        userId,
        content: 'Delete me',
      });

      const res = await request(app)
        .delete(`/api/projects/${projectId}/chapters/${chapterId}/comments/${commentId}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const listRes = await request(app)
        .get(`/api/projects/${projectId}/chapters/${chapterId}/comments`);
      expect(listRes.body.data).toHaveLength(0);
    });

    it('returns 404 for non-existent comment', async () => {
      const res = await request(app)
        .delete(`/api/projects/${projectId}/chapters/${chapterId}/comments/nonexistent`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });
});
