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
    CREATE TABLE chapters (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, volume_id TEXT, title TEXT NOT NULL,
      summary TEXT, word_count INTEGER DEFAULT 0, file_path TEXT NOT NULL,
      status TEXT DEFAULT 'draft', sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')),
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
    CREATE TABLE volumes (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, title TEXT NOT NULL, summary TEXT,
      sort_order INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE characters (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, name TEXT NOT NULL, nickname TEXT,
      role_type TEXT DEFAULT 'supporting', sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE character_relations (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, character_a_id TEXT NOT NULL,
      character_b_id TEXT NOT NULL, relation_type TEXT NOT NULL, description TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE worldviews (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, category TEXT NOT NULL,
      title TEXT NOT NULL, content TEXT, sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE outlines (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, level INTEGER DEFAULT 0,
      parent_id TEXT, target_ref_id TEXT, title TEXT NOT NULL, content TEXT,
      sort_order INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE daily_stats (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, date TEXT NOT NULL,
      words_added INTEGER DEFAULT 0, words_total INTEGER DEFAULT 0,
      writing_time_ms INTEGER DEFAULT 0, chapters_worked INTEGER DEFAULT 0,
      UNIQUE(project_id, date)
    );
    CREATE TABLE writing_sessions (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, chapter_id TEXT NOT NULL,
      started_at TEXT NOT NULL, ended_at TEXT,
      words_start INTEGER DEFAULT 0, words_end INTEGER DEFAULT 0, duration_ms INTEGER DEFAULT 0
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
      PRIMARY KEY (project_id, user_id)
    );
    CREATE TABLE chapter_locks (
      chapter_id TEXT PRIMARY KEY, user_id TEXT NOT NULL,
      locked_at TEXT DEFAULT (datetime('now')), expires_at TEXT
    );
    CREATE TABLE chapter_comments (
      id TEXT PRIMARY KEY, chapter_id TEXT NOT NULL, project_id TEXT NOT NULL,
      user_id TEXT NOT NULL, content TEXT NOT NULL,
      selection_from INTEGER, selection_to INTEGER, selection_text TEXT,
      resolved INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
    );
  `);
  return db;
}

// Mutable mock state — each test can override
let mockVersionStore: {
  versions: any[];
  version: any | null;
  content: string;
  savedVersion: any | null;
  rollbackContent: string | null;
  rollbackError: string | null;
  deleteResult: boolean;
};

describe('Versions Routes', () => {
  let projectId: string;
  let chapterId: string;

  beforeEach(async () => {
    testDb = createTestDb();
    mockVersionStore = {
      versions: [],
      version: null,
      content: '',
      savedVersion: {
        id: 'v1', version_number: 1, chapter_id: 'ch1', project_id: 'p1',
        content_hash: 'abc', word_count: 100, snapshot_type: 'manual',
        label: null, created_at: '2026-01-01T00:00:00.000Z',
      },
      rollbackContent: 'rolled back content',
      rollbackError: null,
      deleteResult: true,
    };

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
      readChapter: vi.fn().mockResolvedValue('test content'),
      writeChapter: vi.fn(), writeVersion: vi.fn(), readVersion: vi.fn().mockResolvedValue('version content'),
      deleteVersionFile: vi.fn(), deleteVersionDir: vi.fn(), ensureProjectDir: vi.fn(), deleteProjectDir: vi.fn(), deleteChapter: vi.fn(),
    }));
    vi.doMock('../../server/services/versionService.js', () => ({
      listVersions: () => mockVersionStore.versions,
      getVersion: () => mockVersionStore.version,
      getVersionContent: async () => mockVersionStore.content,
      saveVersion: async () => mockVersionStore.savedVersion,
      rollbackToVersion: async () => {
        if (mockVersionStore.rollbackError) throw new Error(mockVersionStore.rollbackError);
        return mockVersionStore.rollbackContent;
      },
      deleteVersion: async () => mockVersionStore.deleteResult,
    }));

    const mod = await import('../../server/app.js');
    app = mod.default;

    const projRes = await request(app).post('/api/projects').send({ name: 'Version Test Project' });
    projectId = projRes.body.data.id;

    const chRes = await request(app).post(`/api/projects/${projectId}/chapters`).send({ title: 'Version Chapter' });
    chapterId = chRes.body.data.id;
  });

  afterEach(() => {
    vi.doUnmock('../../server/db/database.js');
    vi.doUnmock('../../server/ws/presenceManager.js');
    vi.doUnmock('../../server/services/analyticsService.js');
    vi.doUnmock('../../server/services/fileService.js');
    vi.doUnmock('../../server/services/versionService.js');
    vi.clearAllMocks();
    if (testDb) testDb.close();
  });

  describe('GET list', () => {
    it('returns empty array when no versions', async () => {
      const res = await request(app).get(`/api/projects/${projectId}/chapters/${chapterId}/versions`);
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });

    it('returns version list', async () => {
      mockVersionStore.versions = [{ id: 'v1', version_number: 1 }];
      const res = await request(app).get(`/api/projects/${projectId}/chapters/${chapterId}/versions`);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });
  });

  describe('GET single version', () => {
    it('returns 404 when version not found', async () => {
      const res = await request(app).get(`/api/projects/${projectId}/chapters/${chapterId}/versions/nonexistent`);
      expect(res.status).toBe(404);
    });

    it('returns version with content', async () => {
      mockVersionStore.version = {
        id: 'ver-1', version_number: 1, chapter_id: chapterId, project_id: projectId,
        content_hash: 'h1', word_count: 200, snapshot_type: 'manual', label: 'Saved',
        created_at: '2026-01-15T10:00:00.000Z',
      };
      mockVersionStore.content = 'The version content';

      const res = await request(app).get(`/api/projects/${projectId}/chapters/${chapterId}/versions/ver-1`);
      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe('ver-1');
      expect(res.body.data.content).toBe('The version content');
    });
  });

  describe('POST create snapshot', () => {
    it('creates a snapshot', async () => {
      mockVersionStore.savedVersion = {
        id: 'v-new', version_number: 1, chapter_id: chapterId, project_id: projectId,
        content_hash: 'new', word_count: 50, snapshot_type: 'manual', label: 'My snap',
        created_at: '2026-01-16T12:00:00.000Z',
      };

      const res = await request(app)
        .post(`/api/projects/${projectId}/chapters/${chapterId}/versions`)
        .send({ label: 'My snap' });

      expect(res.status).toBe(201);
      expect(res.body.data.id).toBe('v-new');
      expect(res.body.data.label).toBe('My snap');
    });

    it('returns null data when content unchanged', async () => {
      mockVersionStore.savedVersion = null;

      const res = await request(app)
        .post(`/api/projects/${projectId}/chapters/${chapterId}/versions`)
        .send({ label: 'Test' });

      expect(res.status).toBe(200);
      expect(res.body.data).toBeNull();
    });
  });

  describe('POST rollback', () => {
    it('rolls back successfully', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/chapters/${chapterId}/versions/ver-1/rollback`);

      expect(res.status).toBe(200);
      expect(res.body.data.content).toBe('rolled back content');
    });

    it('returns 400 on failure', async () => {
      mockVersionStore.rollbackError = '版本不存在';

      const res = await request(app)
        .post(`/api/projects/${projectId}/chapters/${chapterId}/versions/bad/rollback`);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('版本不存在');
    });
  });

  describe('DELETE version', () => {
    it('deletes successfully', async () => {
      const res = await request(app)
        .delete(`/api/projects/${projectId}/chapters/${chapterId}/versions/ver-1`);

      expect(res.status).toBe(200);
    });

    it('returns 404 when not found', async () => {
      mockVersionStore.deleteResult = false;

      const res = await request(app)
        .delete(`/api/projects/${projectId}/chapters/${chapterId}/versions/nonexistent`);

      expect(res.status).toBe(404);
    });
  });
});
