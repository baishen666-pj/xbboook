import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
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
      status TEXT DEFAULT 'draft',
      publish_status TEXT DEFAULT 'draft' CHECK(publish_status IN ('draft','scheduled','published','archived')),
      scheduled_at TEXT,
      sort_order INTEGER DEFAULT 0,
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
      description TEXT, plant_chapter_id TEXT,
      expected_harvest_chapter_id TEXT, actual_harvest_chapter_id TEXT,
      status TEXT NOT NULL DEFAULT 'planted' CHECK(status IN ('planted','harvested','forgotten')),
      importance TEXT DEFAULT 'normal' CHECK(importance IN ('critical','important','normal','minor')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (plant_chapter_id) REFERENCES chapters(id) ON DELETE SET NULL,
      FOREIGN KEY (expected_harvest_chapter_id) REFERENCES chapters(id) ON DELETE SET NULL,
      FOREIGN KEY (actual_harvest_chapter_id) REFERENCES chapters(id) ON DELETE SET NULL
    );
    CREATE INDEX foreshadowing_project_status_idx ON foreshadowing(project_id, status);
  `);
  return db;
}

describe('Schedule Routes', () => {
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
        const m = token.match(/^test-token-(.+)$/);
        return m ? m[1] : null;
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
    vi.doMock('../../server/services/foreshadowingService.js', () => ({
      foreshadowingService: {},
    }));
    const mod = await import('../../server/app.js');
    app = mod.default;

    const res = await request(app)
      .post('/api/projects')
      .send({ name: 'Schedule Test Project', genre: 'fantasy' });
    projectId = res.body.data.id;
  });

  afterEach(() => {
    vi.doUnmock('../../server/db/database.js');
    vi.doUnmock('../../server/ws/presenceManager.js');
    vi.doUnmock('../../server/services/analyticsService.js');
    vi.doUnmock('../../server/services/fileService.js');
    vi.doUnmock('../../server/services/foreshadowingService.js');
    vi.restoreAllMocks();
    if (testDb) testDb.close();
  });

  describe('GET /api/projects/:projectId/chapters/schedule', () => {
    it('returns schedule items for a project', async () => {
      await request(app)
        .post(`/api/projects/${projectId}/chapters`)
        .send({ title: 'Chapter One' });
      await request(app)
        .post(`/api/projects/${projectId}/chapters`)
        .send({ title: 'Chapter Two' });

      const res = await request(app)
        .get(`/api/projects/${projectId}/chapters/schedule`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0]).toHaveProperty('id');
      expect(res.body.data[0]).toHaveProperty('title');
      expect(res.body.data[0]).toHaveProperty('word_count');
      expect(res.body.data[0]).toHaveProperty('publish_status');
      expect(res.body.data[0]).toHaveProperty('scheduled_at');
      expect(res.body.data[0]).toHaveProperty('sort_order');
    });

    it('returns default publish_status as draft', async () => {
      await request(app)
        .post(`/api/projects/${projectId}/chapters`)
        .send({ title: 'Draft Chapter' });

      const res = await request(app)
        .get(`/api/projects/${projectId}/chapters/schedule`);

      expect(res.body.data[0].publish_status).toBe('draft');
      expect(res.body.data[0].scheduled_at).toBeNull();
    });
  });

  describe('PATCH /api/projects/:projectId/chapters/:id/publish-status', () => {
    it('updates publish_status to scheduled', async () => {
      const createRes = await request(app)
        .post(`/api/projects/${projectId}/chapters`)
        .send({ title: 'Schedule Ch' });
      const chapterId = createRes.body.data.id;

      const res = await request(app)
        .patch(`/api/projects/${projectId}/chapters/${chapterId}/publish-status`)
        .send({ publish_status: 'scheduled', scheduled_at: '2026-06-01T10:00:00Z' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.publish_status).toBe('scheduled');
      expect(res.body.data.scheduled_at).toBe('2026-06-01T10:00:00Z');
    });

    it('updates publish_status to published', async () => {
      const createRes = await request(app)
        .post(`/api/projects/${projectId}/chapters`)
        .send({ title: 'Publish Ch' });
      const chapterId = createRes.body.data.id;

      const res = await request(app)
        .patch(`/api/projects/${projectId}/chapters/${chapterId}/publish-status`)
        .send({ publish_status: 'published' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.publish_status).toBe('published');
    });

    it('updates publish_status to archived', async () => {
      const createRes = await request(app)
        .post(`/api/projects/${projectId}/chapters`)
        .send({ title: 'Archive Ch' });
      const chapterId = createRes.body.data.id;

      const res = await request(app)
        .patch(`/api/projects/${projectId}/chapters/${chapterId}/publish-status`)
        .send({ publish_status: 'archived' });

      expect(res.status).toBe(200);
      expect(res.body.data.publish_status).toBe('archived');
    });

    it('rejects invalid publish_status', async () => {
      const createRes = await request(app)
        .post(`/api/projects/${projectId}/chapters`)
        .send({ title: 'Invalid Ch' });
      const chapterId = createRes.body.data.id;

      const res = await request(app)
        .patch(`/api/projects/${projectId}/chapters/${chapterId}/publish-status`)
        .send({ publish_status: 'invalid' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('returns 404 for non-existent chapter', async () => {
      const res = await request(app)
        .patch(`/api/projects/${projectId}/chapters/nonexistent-id/publish-status`)
        .send({ publish_status: 'published' });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('clears scheduled_at when setting publish_status to draft', async () => {
      const createRes = await request(app)
        .post(`/api/projects/${projectId}/chapters`)
        .send({ title: 'Reset Ch' });
      const chapterId = createRes.body.data.id;

      // First set to scheduled
      await request(app)
        .patch(`/api/projects/${projectId}/chapters/${chapterId}/publish-status`)
        .send({ publish_status: 'scheduled', scheduled_at: '2026-06-01T10:00:00Z' });

      // Then set back to draft with null scheduled_at
      const res = await request(app)
        .patch(`/api/projects/${projectId}/chapters/${chapterId}/publish-status`)
        .send({ publish_status: 'draft', scheduled_at: null });

      expect(res.status).toBe(200);
      expect(res.body.data.publish_status).toBe('draft');
      expect(res.body.data.scheduled_at).toBeNull();
    });
  });
});