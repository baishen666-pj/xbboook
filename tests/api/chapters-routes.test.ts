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
  `);
  return db;
}

describe('Chapters Routes', () => {
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
    const mod = await import('../../server/app.js');
    app = mod.default;

    const res = await request(app)
      .post('/api/projects')
      .send({ name: 'Chapter Test Project', genre: 'fantasy' });
    projectId = res.body.data.id;
  });

  afterEach(() => {
    vi.doUnmock('../../server/db/database.js');
    vi.doUnmock('../../server/ws/presenceManager.js');
    vi.doUnmock('../../server/services/analyticsService.js');
    vi.doUnmock('../../server/services/fileService.js');
    vi.restoreAllMocks();
    if (testDb) testDb.close();
  });

  describe('POST /api/projects/:projectId/chapters', () => {
    it('creates a chapter successfully', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/chapters`)
        .send({ title: 'Chapter One' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('Chapter One');
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.project_id).toBe(projectId);
      expect(res.body.data.status).toBe('draft');
      expect(res.body.data.word_count).toBe(0);
    });

    it('creates a chapter with optional volumeId and summary', async () => {
      const volRes = await request(app)
        .post(`/api/projects/${projectId}/volumes`)
        .send({ title: 'Volume 1' });
      const volumeId = volRes.body.data.id;

      const res = await request(app)
        .post(`/api/projects/${projectId}/chapters`)
        .send({ title: 'Chapter with Volume', volumeId, summary: 'A summary' });

      expect(res.status).toBe(201);
      expect(res.body.data.volume_id).toBe(volumeId);
      expect(res.body.data.summary).toBe('A summary');
    });

    it('creates a chapter with null volumeId', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/chapters`)
        .send({ title: 'No Volume', volumeId: null });

      expect(res.status).toBe(201);
      expect(res.body.data.volume_id).toBeNull();
    });

    it('rejects creation with empty title', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/chapters`)
        .send({ title: '' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('rejects creation with missing title', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/chapters`)
        .send({ summary: 'no title' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('assigns incrementing sort_order', async () => {
      const ch1 = await request(app)
        .post(`/api/projects/${projectId}/chapters`)
        .send({ title: 'First' });
      const ch2 = await request(app)
        .post(`/api/projects/${projectId}/chapters`)
        .send({ title: 'Second' });

      expect(ch1.body.data.sort_order).toBe(0);
      expect(ch2.body.data.sort_order).toBe(1);
    });
  });

  describe('GET /api/projects/:projectId/chapters', () => {
    it('returns empty array when no chapters exist', async () => {
      const res = await request(app)
        .get(`/api/projects/${projectId}/chapters`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual([]);
    });

    it('returns all chapters for a project', async () => {
      await request(app)
        .post(`/api/projects/${projectId}/chapters`)
        .send({ title: 'Ch A' });
      await request(app)
        .post(`/api/projects/${projectId}/chapters`)
        .send({ title: 'Ch B' });
      await request(app)
        .post(`/api/projects/${projectId}/chapters`)
        .send({ title: 'Ch C' });

      const res = await request(app)
        .get(`/api/projects/${projectId}/chapters`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(3);
    });

    it('returns chapters ordered by sort_order', async () => {
      await request(app)
        .post(`/api/projects/${projectId}/chapters`)
        .send({ title: 'Ch 1' });
      await request(app)
        .post(`/api/projects/${projectId}/chapters`)
        .send({ title: 'Ch 2' });

      const res = await request(app)
        .get(`/api/projects/${projectId}/chapters`);

      expect(res.body.data[0].sort_order).toBeLessThanOrEqual(res.body.data[1].sort_order);
    });

    it('does not return chapters from other projects', async () => {
      await request(app)
        .post(`/api/projects/${projectId}/chapters`)
        .send({ title: 'Project A Ch' });

      const otherRes = await request(app)
        .post('/api/projects')
        .send({ name: 'Other Project' });
      const otherProjectId = otherRes.body.data.id;
      await request(app)
        .post(`/api/projects/${otherProjectId}/chapters`)
        .send({ title: 'Project B Ch' });

      const res = await request(app)
        .get(`/api/projects/${projectId}/chapters`);

      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].title).toBe('Project A Ch');
    });
  });

  describe('GET /api/projects/:projectId/chapters/:id', () => {
    it('returns a single chapter with content', async () => {
      const createRes = await request(app)
        .post(`/api/projects/${projectId}/chapters`)
        .send({ title: 'Readable Chapter' });
      const chapterId = createRes.body.data.id;

      const res = await request(app)
        .get(`/api/projects/${projectId}/chapters/${chapterId}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(chapterId);
      expect(res.body.data.title).toBe('Readable Chapter');
      expect(res.body.data).toHaveProperty('content');
    });

    it('returns 404 for non-existent chapter', async () => {
      const res = await request(app)
        .get(`/api/projects/${projectId}/chapters/nonexistent-id`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe('PUT /api/projects/:projectId/chapters/:id', () => {
    it('updates chapter title', async () => {
      const createRes = await request(app)
        .post(`/api/projects/${projectId}/chapters`)
        .send({ title: 'Original Title' });
      const chapterId = createRes.body.data.id;

      const res = await request(app)
        .put(`/api/projects/${projectId}/chapters/${chapterId}`)
        .send({ title: 'Updated Title' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('Updated Title');
    });

    it('updates chapter summary', async () => {
      const createRes = await request(app)
        .post(`/api/projects/${projectId}/chapters`)
        .send({ title: 'Summary Ch' });
      const chapterId = createRes.body.data.id;

      const res = await request(app)
        .put(`/api/projects/${projectId}/chapters/${chapterId}`)
        .send({ summary: 'New summary text' });

      expect(res.status).toBe(200);
      expect(res.body.data.summary).toBe('New summary text');
    });

    it('updates chapter status to valid enum values', async () => {
      const createRes = await request(app)
        .post(`/api/projects/${projectId}/chapters`)
        .send({ title: 'Status Ch' });
      const chapterId = createRes.body.data.id;

      const statuses = ['draft', 'writing', 'revised', 'done'] as const;
      for (const status of statuses) {
        const res = await request(app)
          .put(`/api/projects/${projectId}/chapters/${chapterId}`)
          .send({ status });

        expect(res.status).toBe(200);
        expect(res.body.data.status).toBe(status);
      }
    });

    it('updates chapter volume_id', async () => {
      const volRes = await request(app)
        .post(`/api/projects/${projectId}/volumes`)
        .send({ title: 'Vol' });
      const volumeId = volRes.body.data.id;

      const createRes = await request(app)
        .post(`/api/projects/${projectId}/chapters`)
        .send({ title: 'Vol Ch' });
      const chapterId = createRes.body.data.id;

      const res = await request(app)
        .put(`/api/projects/${projectId}/chapters/${chapterId}`)
        .send({ volume_id: volumeId });

      expect(res.status).toBe(200);
      expect(res.body.data.volume_id).toBe(volumeId);
    });

    it('updates chapter sort_order', async () => {
      const createRes = await request(app)
        .post(`/api/projects/${projectId}/chapters`)
        .send({ title: 'Sort Ch' });
      const chapterId = createRes.body.data.id;

      const res = await request(app)
        .put(`/api/projects/${projectId}/chapters/${chapterId}`)
        .send({ sort_order: 42 });

      expect(res.status).toBe(200);
      expect(res.body.data.sort_order).toBe(42);
    });

    it('updates multiple fields at once', async () => {
      const createRes = await request(app)
        .post(`/api/projects/${projectId}/chapters`)
        .send({ title: 'Multi Ch' });
      const chapterId = createRes.body.data.id;

      const res = await request(app)
        .put(`/api/projects/${projectId}/chapters/${chapterId}`)
        .send({ title: 'Multi Updated', summary: 'New summary', status: 'writing' });

      expect(res.status).toBe(200);
      expect(res.body.data.title).toBe('Multi Updated');
      expect(res.body.data.summary).toBe('New summary');
      expect(res.body.data.status).toBe('writing');
    });

    it('returns unchanged chapter when no valid fields are provided', async () => {
      const createRes = await request(app)
        .post(`/api/projects/${projectId}/chapters`)
        .send({ title: 'No Change Ch' });
      const chapterId = createRes.body.data.id;

      const res = await request(app)
        .put(`/api/projects/${projectId}/chapters/${chapterId}`)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.data.title).toBe('No Change Ch');
    });

    it('returns 404 for non-existent chapter', async () => {
      const res = await request(app)
        .put(`/api/projects/${projectId}/chapters/nonexistent-id`)
        .send({ title: 'Does Not Matter' });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('rejects invalid status value', async () => {
      const createRes = await request(app)
        .post(`/api/projects/${projectId}/chapters`)
        .send({ title: 'Invalid Status Ch' });
      const chapterId = createRes.body.data.id;

      const res = await request(app)
        .put(`/api/projects/${projectId}/chapters/${chapterId}`)
        .send({ status: 'invalid_status' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('rejects empty title in update', async () => {
      const createRes = await request(app)
        .post(`/api/projects/${projectId}/chapters`)
        .send({ title: 'Title Ch' });
      const chapterId = createRes.body.data.id;

      const res = await request(app)
        .put(`/api/projects/${projectId}/chapters/${chapterId}`)
        .send({ title: '' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('PUT /api/projects/:projectId/chapters/:id/content', () => {
    it('updates chapter content', async () => {
      const createRes = await request(app)
        .post(`/api/projects/${projectId}/chapters`)
        .send({ title: 'Content Ch' });
      const chapterId = createRes.body.data.id;

      const res = await request(app)
        .put(`/api/projects/${projectId}/chapters/${chapterId}/content`)
        .send({ content: 'This is the chapter content.' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(chapterId);
    });

    it('updates word count based on content length', async () => {
      const createRes = await request(app)
        .post(`/api/projects/${projectId}/chapters`)
        .send({ title: 'Word Count Ch' });
      const chapterId = createRes.body.data.id;

      const content = 'Hello world, this is test content.';
      const res = await request(app)
        .put(`/api/projects/${projectId}/chapters/${chapterId}/content`)
        .send({ content });

      expect(res.status).toBe(200);
      expect(res.body.data.word_count).toBe(content.length);
    });

    it('returns 404 for non-existent chapter', async () => {
      const res = await request(app)
        .put(`/api/projects/${projectId}/chapters/nonexistent-id/content`)
        .send({ content: 'some text' });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('rejects missing content field', async () => {
      const createRes = await request(app)
        .post(`/api/projects/${projectId}/chapters`)
        .send({ title: 'No Content Ch' });
      const chapterId = createRes.body.data.id;

      const res = await request(app)
        .put(`/api/projects/${projectId}/chapters/${chapterId}/content`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('accepts empty string content', async () => {
      const createRes = await request(app)
        .post(`/api/projects/${projectId}/chapters`)
        .send({ title: 'Empty Content Ch' });
      const chapterId = createRes.body.data.id;

      const res = await request(app)
        .put(`/api/projects/${projectId}/chapters/${chapterId}/content`)
        .send({ content: '' });

      expect(res.status).toBe(200);
      expect(res.body.data.word_count).toBe(0);
    });
  });

  describe('PUT /api/projects/:projectId/chapters/reorder', () => {
    it('reorders chapters', async () => {
      const ch1 = await request(app)
        .post(`/api/projects/${projectId}/chapters`)
        .send({ title: 'Ch 1' });
      const ch2 = await request(app)
        .post(`/api/projects/${projectId}/chapters`)
        .send({ title: 'Ch 2' });
      const ch3 = await request(app)
        .post(`/api/projects/${projectId}/chapters`)
        .send({ title: 'Ch 3' });

      const id1 = ch1.body.data.id;
      const id2 = ch2.body.data.id;
      const id3 = ch3.body.data.id;

      const res = await request(app)
        .put(`/api/projects/${projectId}/chapters/reorder`)
        .send({
          items: [
            { id: id3, sortOrder: 0 },
            { id: id1, sortOrder: 1 },
            { id: id2, sortOrder: 2 },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const listRes = await request(app)
        .get(`/api/projects/${projectId}/chapters`);
      const chapters = listRes.body.data;
      expect(chapters[0].id).toBe(id3);
      expect(chapters[1].id).toBe(id1);
      expect(chapters[2].id).toBe(id2);
    });

    it('reorders chapters with volumeId', async () => {
      const volRes = await request(app)
        .post(`/api/projects/${projectId}/volumes`)
        .send({ title: 'Vol' });
      const volumeId = volRes.body.data.id;

      const ch1 = await request(app)
        .post(`/api/projects/${projectId}/chapters`)
        .send({ title: 'Ch 1' });
      const ch2 = await request(app)
        .post(`/api/projects/${projectId}/chapters`)
        .send({ title: 'Ch 2' });

      const res = await request(app)
        .put(`/api/projects/${projectId}/chapters/reorder`)
        .send({
          items: [
            { id: ch1.body.data.id, sortOrder: 0, volumeId },
            { id: ch2.body.data.id, sortOrder: 1, volumeId: null },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const listRes = await request(app)
        .get(`/api/projects/${projectId}/chapters`);
      expect(listRes.body.data[0].volume_id).toBe(volumeId);
    });

    it('rejects missing items array', async () => {
      const res = await request(app)
        .put(`/api/projects/${projectId}/chapters/reorder`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('rejects items with missing required fields', async () => {
      const res = await request(app)
        .put(`/api/projects/${projectId}/chapters/reorder`)
        .send({ items: [{ id: 'abc' }] });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('DELETE /api/projects/:projectId/chapters/:id', () => {
    it('deletes a chapter', async () => {
      const createRes = await request(app)
        .post(`/api/projects/${projectId}/chapters`)
        .send({ title: 'To Delete' });
      const chapterId = createRes.body.data.id;

      const res = await request(app)
        .delete(`/api/projects/${projectId}/chapters/${chapterId}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const listRes = await request(app)
        .get(`/api/projects/${projectId}/chapters`);
      expect(listRes.body.data).toHaveLength(0);
    });

    it('returns 404 for non-existent chapter', async () => {
      const res = await request(app)
        .delete(`/api/projects/${projectId}/chapters/nonexistent-id`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('deleting a chapter does not affect other chapters', async () => {
      const ch1 = await request(app)
        .post(`/api/projects/${projectId}/chapters`)
        .send({ title: 'Keep' });
      const ch2 = await request(app)
        .post(`/api/projects/${projectId}/chapters`)
        .send({ title: 'Remove' });

      await request(app)
        .delete(`/api/projects/${projectId}/chapters/${ch2.body.data.id}`);

      const listRes = await request(app)
        .get(`/api/projects/${projectId}/chapters`);
      expect(listRes.body.data).toHaveLength(1);
      expect(listRes.body.data[0].id).toBe(ch1.body.data.id);
    });
  });

  describe('Full CRUD workflow', () => {
    it('creates, reads, updates, and deletes a chapter', async () => {
      // Create
      const createRes = await request(app)
        .post(`/api/projects/${projectId}/chapters`)
        .send({ title: 'Workflow Chapter', summary: 'Initial summary' });
      expect(createRes.status).toBe(201);
      const chapterId = createRes.body.data.id;

      // Read
      const getRes = await request(app)
        .get(`/api/projects/${projectId}/chapters/${chapterId}`);
      expect(getRes.status).toBe(200);
      expect(getRes.body.data.title).toBe('Workflow Chapter');

      // Update metadata
      const updateRes = await request(app)
        .put(`/api/projects/${projectId}/chapters/${chapterId}`)
        .send({ title: 'Updated Workflow', status: 'writing' });
      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.title).toBe('Updated Workflow');
      expect(updateRes.body.data.status).toBe('writing');

      // Update content
      const contentRes = await request(app)
        .put(`/api/projects/${projectId}/chapters/${chapterId}/content`)
        .send({ content: 'The chapter body text.' });
      expect(contentRes.status).toBe(200);

      // List
      const listRes = await request(app)
        .get(`/api/projects/${projectId}/chapters`);
      expect(listRes.body.data).toHaveLength(1);
      expect(listRes.body.data[0].title).toBe('Updated Workflow');

      // Delete
      const deleteRes = await request(app)
        .delete(`/api/projects/${projectId}/chapters/${chapterId}`);
      expect(deleteRes.status).toBe(200);

      // Verify deleted
      const afterDelete = await request(app)
        .get(`/api/projects/${projectId}/chapters/${chapterId}`);
      expect(afterDelete.status).toBe(404);
    });
  });
});
