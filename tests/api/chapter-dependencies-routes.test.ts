import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import Database from 'better-sqlite3';

let testDb: Database.Database;

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
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, name TEXT NOT NULL,
      nickname TEXT, role_type TEXT DEFAULT 'supporting', gender TEXT, age TEXT,
      appearance TEXT, personality TEXT, background TEXT, abilities TEXT, notes TEXT,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')),
      speech_style TEXT, verbal_tics TEXT, vocabulary_level TEXT DEFAULT 'moderate',
      sentence_length_pref TEXT DEFAULT 'medium', emotional_expressiveness TEXT DEFAULT 'moderate',
      voice_examples TEXT,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
    CREATE TABLE scenes (
      id TEXT PRIMARY KEY, chapter_id TEXT NOT NULL, project_id TEXT NOT NULL,
      title TEXT NOT NULL, summary TEXT DEFAULT '',
      content_start_offset INTEGER DEFAULT 0, content_end_offset INTEGER DEFAULT 0,
      tags TEXT DEFAULT '[]', mood TEXT DEFAULT '', location TEXT DEFAULT '',
      time_of_day TEXT DEFAULT '', pov_character_id TEXT,
      sort_order INTEGER DEFAULT 0,
      status TEXT DEFAULT 'draft' CHECK(status IN ('draft','writing','revising','done')),
      word_count INTEGER DEFAULT 0, notes TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (pov_character_id) REFERENCES characters(id) ON DELETE SET NULL
    );
    CREATE TABLE chapter_dependencies (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL,
      source_chapter_id TEXT NOT NULL, target_chapter_id TEXT NOT NULL,
      dependency_type TEXT DEFAULT 'plot' CHECK(dependency_type IN ('plot','character','foreshadowing','timeline','worldview')),
      description TEXT DEFAULT '',
      strength TEXT DEFAULT 'normal' CHECK(strength IN ('weak','normal','strong')),
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (source_chapter_id) REFERENCES chapters(id) ON DELETE CASCADE,
      FOREIGN KEY (target_chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
    );
    CREATE TABLE chat_messages (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, chapter_id TEXT,
      role TEXT NOT NULL CHECK(role IN ('user','assistant','system')),
      content TEXT NOT NULL, skill_id TEXT DEFAULT '', token_usage INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
    );
    CREATE TABLE daily_stats (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, date TEXT NOT NULL,
      words_added INTEGER DEFAULT 0, words_total INTEGER DEFAULT 0,
      writing_time_ms INTEGER DEFAULT 0, chapters_worked INTEGER DEFAULT 0,
      UNIQUE(project_id, date),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
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
    CREATE TABLE chapter_comments (
      id TEXT PRIMARY KEY, chapter_id TEXT NOT NULL, project_id TEXT NOT NULL,
      user_id TEXT NOT NULL, content TEXT NOT NULL,
      selection_from INTEGER, selection_to INTEGER, selection_text TEXT,
      resolved INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
    );
  `);
  return db;
}

describe('Chapter Dependencies Routes', () => {
  let app: any;
  let projectId: string;
  let ch1Id: string, ch2Id: string, ch3Id: string;

  beforeEach(async () => {
    testDb = createTestDb();
    vi.doMock('../../server/db/database.js', () => ({ getDb: () => testDb, closeDb: () => {} }));
    vi.doMock('../../server/ws/presenceManager.js', () => ({
      generateToken: (uid: string) => `test-token-${uid}`,
      validateToken: (t: string) => { const m = t.match(/^test-token-(.+)$/); return m ? m[1] : null; },
      addConnection: vi.fn(), removeConnection: vi.fn(), getOnlineUsers: () => [], broadcastToProject: vi.fn(),
    }));
    vi.doMock('../../server/services/fileService.js', () => ({
      readChapter: vi.fn().mockResolvedValue(''), writeChapter: vi.fn(), deleteChapter: vi.fn(),
      ensureProjectDir: vi.fn().mockResolvedValue(undefined), deleteProjectDir: vi.fn().mockResolvedValue(undefined),
    }));
    vi.doMock('../../server/services/analyticsService.js', async () => {
      const actual = await vi.importActual<typeof import('../../server/services/analyticsService.js')>('../../server/services/analyticsService.js');
      return { ...actual, getCharacterAppearances: async () => [] };
    });
    const mod = await import('../../server/app.js');
    app = mod.default;

    const res = await request(app).post('/api/projects').send({ name: 'Dep Test', genre: 'fantasy' });
    projectId = res.body.data.id;

    const r1 = await request(app).post(`/api/projects/${projectId}/chapters`).send({ title: '第一章' });
    ch1Id = r1.body.data.id;
    const r2 = await request(app).post(`/api/projects/${projectId}/chapters`).send({ title: '第二章' });
    ch2Id = r2.body.data.id;
    const r3 = await request(app).post(`/api/projects/${projectId}/chapters`).send({ title: '第三章' });
    ch3Id = r3.body.data.id;
  });

  afterEach(() => {
    vi.doUnmock('../../server/db/database.js');
    vi.doUnmock('../../server/ws/presenceManager.js');
    vi.doUnmock('../../server/services/fileService.js');
    vi.doUnmock('../../server/services/analyticsService.js');
    vi.restoreAllMocks();
    if (testDb) testDb.close();
  });

  describe('GET /dependencies', () => {
    it('returns empty list', async () => {
      const res = await request(app).get(`/api/projects/${projectId}/dependencies`);
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });
  });

  describe('POST /dependencies', () => {
    it('creates a dependency', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/dependencies`)
        .send({ sourceChapterId: ch2Id, targetChapterId: ch1Id, dependencyType: 'plot', strength: 'strong' });

      expect(res.status).toBe(201);
      expect(res.body.data.source_chapter_id).toBe(ch2Id);
      expect(res.body.data.strength).toBe('strong');
    });

    it('rejects self-dependency', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/dependencies`)
        .send({ sourceChapterId: ch1Id, targetChapterId: ch1Id });

      expect(res.status).toBe(400);
    });
  });

  describe('PUT /dependencies/:depId', () => {
    it('updates a dependency', async () => {
      const createRes = await request(app)
        .post(`/api/projects/${projectId}/dependencies`)
        .send({ sourceChapterId: ch2Id, targetChapterId: ch1Id });
      const depId = createRes.body.data.id;

      const res = await request(app)
        .put(`/api/projects/${projectId}/dependencies/${depId}`)
        .send({ strength: 'weak', description: 'weak link' });

      expect(res.status).toBe(200);
      expect(res.body.data.strength).toBe('weak');
    });
  });

  describe('DELETE /dependencies/:depId', () => {
    it('deletes a dependency', async () => {
      const createRes = await request(app)
        .post(`/api/projects/${projectId}/dependencies`)
        .send({ sourceChapterId: ch2Id, targetChapterId: ch1Id });
      const depId = createRes.body.data.id;

      const res = await request(app).delete(`/api/projects/${projectId}/dependencies/${depId}`);
      expect(res.status).toBe(200);
    });
  });

  describe('GET /dependencies/cycles', () => {
    it('detects circular dependencies', async () => {
      await request(app).post(`/api/projects/${projectId}/dependencies`)
        .send({ sourceChapterId: ch1Id, targetChapterId: ch2Id });
      await request(app).post(`/api/projects/${projectId}/dependencies`)
        .send({ sourceChapterId: ch2Id, targetChapterId: ch3Id });
      await request(app).post(`/api/projects/${projectId}/dependencies`)
        .send({ sourceChapterId: ch3Id, targetChapterId: ch1Id });

      const res = await request(app).get(`/api/projects/${projectId}/dependencies/cycles`);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
    });
  });

  describe('GET /dependencies/stats', () => {
    it('returns stats', async () => {
      await request(app).post(`/api/projects/${projectId}/dependencies`)
        .send({ sourceChapterId: ch2Id, targetChapterId: ch1Id, dependencyType: 'plot' });

      const res = await request(app).get(`/api/projects/${projectId}/dependencies/stats`);
      expect(res.status).toBe(200);
      expect(res.body.data.total).toBe(1);
      expect(res.body.data.byType.plot).toBe(1);
    });
  });
});
