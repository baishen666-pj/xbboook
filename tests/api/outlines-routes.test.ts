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

describe('Outlines API', () => {
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
  });

  afterEach(() => {
    vi.doUnmock('../../server/db/database.js');
    vi.doUnmock('../../server/ws/presenceManager.js');
    vi.doUnmock('../../server/services/analyticsService.js');
    vi.restoreAllMocks();
    if (testDb) testDb.close();
  });

  async function createProject() {
    const res = await request(app).post('/api/projects').send({ name: 'Test Project' });
    return res.body.data.id;
  }

  describe('POST /api/projects/:projectId/outlines', () => {
    it('should create an outline with required fields only', async () => {
      const projectId = await createProject();

      const res = await request(app)
        .post(`/api/projects/${projectId}/outlines`)
        .send({ title: 'Act 1' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.title).toBe('Act 1');
      expect(res.body.data.content).toBeNull();
      expect(res.body.data.level).toBe(0);
      expect(res.body.data.parent_id).toBeNull();
      expect(res.body.data.target_ref_id).toBeNull();
      expect(res.body.data.project_id).toBe(projectId);
      expect(res.body.data.sort_order).toBe(0);
    });

    it('should create an outline with all optional fields', async () => {
      const projectId = await createProject();

      const res = await request(app)
        .post(`/api/projects/${projectId}/outlines`)
        .send({
          title: 'Act 1',
          content: 'The hero begins their journey.',
          level: 1,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('Act 1');
      expect(res.body.data.content).toBe('The hero begins their journey.');
      expect(res.body.data.level).toBe(1);
    });

    it('should auto-increment sort_order for subsequent outlines', async () => {
      const projectId = await createProject();

      const first = await request(app)
        .post(`/api/projects/${projectId}/outlines`)
        .send({ title: 'First' });

      const second = await request(app)
        .post(`/api/projects/${projectId}/outlines`)
        .send({ title: 'Second' });

      expect(first.body.data.sort_order).toBe(0);
      expect(second.body.data.sort_order).toBe(1);
    });

    it('should create outline with parentId', async () => {
      const projectId = await createProject();

      const parent = await request(app)
        .post(`/api/projects/${projectId}/outlines`)
        .send({ title: 'Parent Outline' });

      const child = await request(app)
        .post(`/api/projects/${projectId}/outlines`)
        .send({ title: 'Child Outline', parentId: parent.body.data.id });

      expect(child.status).toBe(201);
      expect(child.body.data.parent_id).toBe(parent.body.data.id);
    });

    it('should create outline with targetRefId', async () => {
      const projectId = await createProject();

      const res = await request(app)
        .post(`/api/projects/${projectId}/outlines`)
        .send({ title: 'With Ref', targetRefId: '550e8400-e29b-41d4-a716-446655440000' });

      expect(res.status).toBe(201);
      expect(res.body.data.target_ref_id).toBe('550e8400-e29b-41d4-a716-446655440000');
    });

    it('should accept level at boundary 0', async () => {
      const projectId = await createProject();

      const res = await request(app)
        .post(`/api/projects/${projectId}/outlines`)
        .send({ title: 'Level Zero', level: 0 });

      expect(res.status).toBe(201);
      expect(res.body.data.level).toBe(0);
    });

    it('should accept level at boundary 10', async () => {
      const projectId = await createProject();

      const res = await request(app)
        .post(`/api/projects/${projectId}/outlines`)
        .send({ title: 'Level Ten', level: 10 });

      expect(res.status).toBe(201);
      expect(res.body.data.level).toBe(10);
    });

    it('should accept title at exactly 200 characters', async () => {
      const projectId = await createProject();

      const res = await request(app)
        .post(`/api/projects/${projectId}/outlines`)
        .send({ title: 'x'.repeat(200) });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('should accept content at exactly 50000 characters', async () => {
      const projectId = await createProject();

      const res = await request(app)
        .post(`/api/projects/${projectId}/outlines`)
        .send({ title: 'Max Content', content: 'x'.repeat(50000) });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('should accept null parentId', async () => {
      const projectId = await createProject();

      const res = await request(app)
        .post(`/api/projects/${projectId}/outlines`)
        .send({ title: 'Null Parent', parentId: null });

      expect(res.status).toBe(201);
      expect(res.body.data.parent_id).toBeNull();
    });

    it('should accept null targetRefId', async () => {
      const projectId = await createProject();

      const res = await request(app)
        .post(`/api/projects/${projectId}/outlines`)
        .send({ title: 'Null Ref', targetRefId: null });

      expect(res.status).toBe(201);
      expect(res.body.data.target_ref_id).toBeNull();
    });

    it('should reject missing title', async () => {
      const projectId = await createProject();

      const res = await request(app)
        .post(`/api/projects/${projectId}/outlines`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject empty title', async () => {
      const projectId = await createProject();

      const res = await request(app)
        .post(`/api/projects/${projectId}/outlines`)
        .send({ title: '' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject title exceeding 200 characters', async () => {
      const projectId = await createProject();

      const res = await request(app)
        .post(`/api/projects/${projectId}/outlines`)
        .send({ title: 'x'.repeat(201) });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject content exceeding 50000 characters', async () => {
      const projectId = await createProject();

      const res = await request(app)
        .post(`/api/projects/${projectId}/outlines`)
        .send({ title: 'Overflow Content', content: 'x'.repeat(50001) });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject level below 0', async () => {
      const projectId = await createProject();

      const res = await request(app)
        .post(`/api/projects/${projectId}/outlines`)
        .send({ title: 'Negative Level', level: -1 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject level above 10', async () => {
      const projectId = await createProject();

      const res = await request(app)
        .post(`/api/projects/${projectId}/outlines`)
        .send({ title: 'High Level', level: 11 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject non-integer level', async () => {
      const projectId = await createProject();

      const res = await request(app)
        .post(`/api/projects/${projectId}/outlines`)
        .send({ title: 'Float Level', level: 3.5 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject invalid parentId uuid', async () => {
      const projectId = await createProject();

      const res = await request(app)
        .post(`/api/projects/${projectId}/outlines`)
        .send({ title: 'Bad Parent', parentId: 'not-a-uuid' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject invalid targetRefId uuid', async () => {
      const projectId = await createProject();

      const res = await request(app)
        .post(`/api/projects/${projectId}/outlines`)
        .send({ title: 'Bad Ref', targetRefId: 'not-a-uuid' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject non-string title', async () => {
      const projectId = await createProject();

      const res = await request(app)
        .post(`/api/projects/${projectId}/outlines`)
        .send({ title: 123 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/projects/:projectId/outlines', () => {
    it('should return empty array when no outlines exist', async () => {
      const projectId = await createProject();

      const res = await request(app)
        .get(`/api/projects/${projectId}/outlines`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual([]);
    });

    it('should list all outlines for a project', async () => {
      const projectId = await createProject();

      await request(app)
        .post(`/api/projects/${projectId}/outlines`)
        .send({ title: 'Outline A' });
      await request(app)
        .post(`/api/projects/${projectId}/outlines`)
        .send({ title: 'Outline B' });
      await request(app)
        .post(`/api/projects/${projectId}/outlines`)
        .send({ title: 'Outline C' });

      const res = await request(app)
        .get(`/api/projects/${projectId}/outlines`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(3);
    });

    it('should only return outlines for the specified project', async () => {
      const projectA = await createProject();
      const projectB = await createProject();

      await request(app)
        .post(`/api/projects/${projectA}/outlines`)
        .send({ title: 'A Only' });
      await request(app)
        .post(`/api/projects/${projectB}/outlines`)
        .send({ title: 'B Only' });

      const resA = await request(app).get(`/api/projects/${projectA}/outlines`);
      const resB = await request(app).get(`/api/projects/${projectB}/outlines`);

      expect(resA.body.data).toHaveLength(1);
      expect(resA.body.data[0].title).toBe('A Only');
      expect(resB.body.data).toHaveLength(1);
      expect(resB.body.data[0].title).toBe('B Only');
    });

    it('should order outlines by level then sort_order', async () => {
      const projectId = await createProject();

      await request(app)
        .post(`/api/projects/${projectId}/outlines`)
        .send({ title: 'Level 1', level: 1 });
      await request(app)
        .post(`/api/projects/${projectId}/outlines`)
        .send({ title: 'Level 0', level: 0 });
      await request(app)
        .post(`/api/projects/${projectId}/outlines`)
        .send({ title: 'Level 0 Second', level: 0 });

      const res = await request(app)
        .get(`/api/projects/${projectId}/outlines`);

      const titles = res.body.data.map((o: any) => o.title);
      expect(titles[0]).toBe('Level 0');
      expect(titles[1]).toBe('Level 0 Second');
      expect(titles[2]).toBe('Level 1');
    });
  });

  describe('GET /api/projects/:projectId/outlines/:id', () => {
    it('should return a single outline with its children', async () => {
      const projectId = await createProject();

      const parentRes = await request(app)
        .post(`/api/projects/${projectId}/outlines`)
        .send({ title: 'Parent', content: 'Parent content' });

      const parentId = parentRes.body.data.id;

      await request(app)
        .post(`/api/projects/${projectId}/outlines`)
        .send({ title: 'Child 1', parentId });
      await request(app)
        .post(`/api/projects/${projectId}/outlines`)
        .send({ title: 'Child 2', parentId });

      const res = await request(app)
        .get(`/api/projects/${projectId}/outlines/${parentId}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.outline.id).toBe(parentId);
      expect(res.body.data.outline.title).toBe('Parent');
      expect(res.body.data.outline.content).toBe('Parent content');
      expect(res.body.data.children).toHaveLength(2);
      expect(res.body.data.children.map((c: any) => c.title)).toEqual(['Child 1', 'Child 2']);
    });

    it('should return empty children array when outline has no children', async () => {
      const projectId = await createProject();

      const createRes = await request(app)
        .post(`/api/projects/${projectId}/outlines`)
        .send({ title: 'Leaf Node' });

      const res = await request(app)
        .get(`/api/projects/${projectId}/outlines/${createRes.body.data.id}`);

      expect(res.status).toBe(200);
      expect(res.body.data.outline.title).toBe('Leaf Node');
      expect(res.body.data.children).toEqual([]);
    });

    it('should return 404 for non-existent outline', async () => {
      const projectId = await createProject();

      const res = await request(app)
        .get(`/api/projects/${projectId}/outlines/nonexistent-id`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe('PUT /api/projects/:projectId/outlines/:id', () => {
    it('should update title', async () => {
      const projectId = await createProject();

      const createRes = await request(app)
        .post(`/api/projects/${projectId}/outlines`)
        .send({ title: 'Original' });

      const res = await request(app)
        .put(`/api/projects/${projectId}/outlines/${createRes.body.data.id}`)
        .send({ title: 'Updated' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('Updated');
    });

    it('should update content', async () => {
      const projectId = await createProject();

      const createRes = await request(app)
        .post(`/api/projects/${projectId}/outlines`)
        .send({ title: 'Test' });

      const res = await request(app)
        .put(`/api/projects/${projectId}/outlines/${createRes.body.data.id}`)
        .send({ content: 'New content' });

      expect(res.status).toBe(200);
      expect(res.body.data.content).toBe('New content');
    });

    it('should update level', async () => {
      const projectId = await createProject();

      const createRes = await request(app)
        .post(`/api/projects/${projectId}/outlines`)
        .send({ title: 'Test', level: 0 });

      const res = await request(app)
        .put(`/api/projects/${projectId}/outlines/${createRes.body.data.id}`)
        .send({ level: 5 });

      expect(res.status).toBe(200);
      expect(res.body.data.level).toBe(5);
    });

    it('should update sort_order', async () => {
      const projectId = await createProject();

      const createRes = await request(app)
        .post(`/api/projects/${projectId}/outlines`)
        .send({ title: 'Test' });

      const res = await request(app)
        .put(`/api/projects/${projectId}/outlines/${createRes.body.data.id}`)
        .send({ sort_order: 10 });

      expect(res.status).toBe(200);
      expect(res.body.data.sort_order).toBe(10);
    });

    it('should update parent_id', async () => {
      const projectId = await createProject();

      const parentRes = await request(app)
        .post(`/api/projects/${projectId}/outlines`)
        .send({ title: 'Parent' });
      const childRes = await request(app)
        .post(`/api/projects/${projectId}/outlines`)
        .send({ title: 'Child' });

      const res = await request(app)
        .put(`/api/projects/${projectId}/outlines/${childRes.body.data.id}`)
        .send({ parent_id: parentRes.body.data.id });

      expect(res.status).toBe(200);
      expect(res.body.data.parent_id).toBe(parentRes.body.data.id);
    });

    it('should update target_ref_id', async () => {
      const projectId = await createProject();

      const createRes = await request(app)
        .post(`/api/projects/${projectId}/outlines`)
        .send({ title: 'Test' });

      const newRefId = '550e8400-e29b-41d4-a716-446655440000';
      const res = await request(app)
        .put(`/api/projects/${projectId}/outlines/${createRes.body.data.id}`)
        .send({ target_ref_id: newRefId });

      expect(res.status).toBe(200);
      expect(res.body.data.target_ref_id).toBe(newRefId);
    });

    it('should update multiple fields at once', async () => {
      const projectId = await createProject();

      const createRes = await request(app)
        .post(`/api/projects/${projectId}/outlines`)
        .send({ title: 'Original' });

      const res = await request(app)
        .put(`/api/projects/${projectId}/outlines/${createRes.body.data.id}`)
        .send({ title: 'Updated Title', content: 'New content', level: 3, sort_order: 5 });

      expect(res.status).toBe(200);
      expect(res.body.data.title).toBe('Updated Title');
      expect(res.body.data.content).toBe('New content');
      expect(res.body.data.level).toBe(3);
      expect(res.body.data.sort_order).toBe(5);
    });

    it('should return existing outline when body is empty', async () => {
      const projectId = await createProject();

      const createRes = await request(app)
        .post(`/api/projects/${projectId}/outlines`)
        .send({ title: 'Unchanged' });

      const res = await request(app)
        .put(`/api/projects/${projectId}/outlines/${createRes.body.data.id}`)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.data.title).toBe('Unchanged');
    });

    it('should set parent_id to null', async () => {
      const projectId = await createProject();

      const parentRes = await request(app)
        .post(`/api/projects/${projectId}/outlines`)
        .send({ title: 'Parent' });
      const childRes = await request(app)
        .post(`/api/projects/${projectId}/outlines`)
        .send({ title: 'Child', parentId: parentRes.body.data.id });

      expect(childRes.body.data.parent_id).toBe(parentRes.body.data.id);

      const res = await request(app)
        .put(`/api/projects/${projectId}/outlines/${childRes.body.data.id}`)
        .send({ parent_id: null });

      expect(res.status).toBe(200);
      expect(res.body.data.parent_id).toBeNull();
    });

    it('should set target_ref_id to null', async () => {
      const projectId = await createProject();

      const createRes = await request(app)
        .post(`/api/projects/${projectId}/outlines`)
        .send({ title: 'Test', targetRefId: '550e8400-e29b-41d4-a716-446655440000' });

      const res = await request(app)
        .put(`/api/projects/${projectId}/outlines/${createRes.body.data.id}`)
        .send({ target_ref_id: null });

      expect(res.status).toBe(200);
      expect(res.body.data.target_ref_id).toBeNull();
    });

    it('should return 404 for non-existent outline', async () => {
      const projectId = await createProject();

      const res = await request(app)
        .put(`/api/projects/${projectId}/outlines/nonexistent-id`)
        .send({ title: 'Does Not Matter' });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('should reject empty title on update', async () => {
      const projectId = await createProject();

      const createRes = await request(app)
        .post(`/api/projects/${projectId}/outlines`)
        .send({ title: 'Valid' });

      const res = await request(app)
        .put(`/api/projects/${projectId}/outlines/${createRes.body.data.id}`)
        .send({ title: '' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject title exceeding 200 characters on update', async () => {
      const projectId = await createProject();

      const createRes = await request(app)
        .post(`/api/projects/${projectId}/outlines`)
        .send({ title: 'Valid' });

      const res = await request(app)
        .put(`/api/projects/${projectId}/outlines/${createRes.body.data.id}`)
        .send({ title: 'x'.repeat(201) });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject content exceeding 50000 characters on update', async () => {
      const projectId = await createProject();

      const createRes = await request(app)
        .post(`/api/projects/${projectId}/outlines`)
        .send({ title: 'Valid' });

      const res = await request(app)
        .put(`/api/projects/${projectId}/outlines/${createRes.body.data.id}`)
        .send({ content: 'x'.repeat(50001) });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject level below 0 on update', async () => {
      const projectId = await createProject();

      const createRes = await request(app)
        .post(`/api/projects/${projectId}/outlines`)
        .send({ title: 'Valid' });

      const res = await request(app)
        .put(`/api/projects/${projectId}/outlines/${createRes.body.data.id}`)
        .send({ level: -1 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject level above 10 on update', async () => {
      const projectId = await createProject();

      const createRes = await request(app)
        .post(`/api/projects/${projectId}/outlines`)
        .send({ title: 'Valid' });

      const res = await request(app)
        .put(`/api/projects/${projectId}/outlines/${createRes.body.data.id}`)
        .send({ level: 11 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject non-integer level on update', async () => {
      const projectId = await createProject();

      const createRes = await request(app)
        .post(`/api/projects/${projectId}/outlines`)
        .send({ title: 'Valid' });

      const res = await request(app)
        .put(`/api/projects/${projectId}/outlines/${createRes.body.data.id}`)
        .send({ level: 2.5 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject negative sort_order on update', async () => {
      const projectId = await createProject();

      const createRes = await request(app)
        .post(`/api/projects/${projectId}/outlines`)
        .send({ title: 'Valid' });

      const res = await request(app)
        .put(`/api/projects/${projectId}/outlines/${createRes.body.data.id}`)
        .send({ sort_order: -1 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject non-integer sort_order on update', async () => {
      const projectId = await createProject();

      const createRes = await request(app)
        .post(`/api/projects/${projectId}/outlines`)
        .send({ title: 'Valid' });

      const res = await request(app)
        .put(`/api/projects/${projectId}/outlines/${createRes.body.data.id}`)
        .send({ sort_order: 1.5 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject invalid parent_id uuid on update', async () => {
      const projectId = await createProject();

      const createRes = await request(app)
        .post(`/api/projects/${projectId}/outlines`)
        .send({ title: 'Valid' });

      const res = await request(app)
        .put(`/api/projects/${projectId}/outlines/${createRes.body.data.id}`)
        .send({ parent_id: 'not-a-uuid' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject invalid target_ref_id uuid on update', async () => {
      const projectId = await createProject();

      const createRes = await request(app)
        .post(`/api/projects/${projectId}/outlines`)
        .send({ title: 'Valid' });

      const res = await request(app)
        .put(`/api/projects/${projectId}/outlines/${createRes.body.data.id}`)
        .send({ target_ref_id: 'not-a-uuid' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should accept sort_order of 0 on update', async () => {
      const projectId = await createProject();

      const createRes = await request(app)
        .post(`/api/projects/${projectId}/outlines`)
        .send({ title: 'Valid' });

      const res = await request(app)
        .put(`/api/projects/${projectId}/outlines/${createRes.body.data.id}`)
        .send({ sort_order: 0 });

      expect(res.status).toBe(200);
      expect(res.body.data.sort_order).toBe(0);
    });
  });

  describe('DELETE /api/projects/:projectId/outlines/:id', () => {
    it('should delete an existing outline', async () => {
      const projectId = await createProject();

      const createRes = await request(app)
        .post(`/api/projects/${projectId}/outlines`)
        .send({ title: 'To Delete' });

      const deleteRes = await request(app)
        .delete(`/api/projects/${projectId}/outlines/${createRes.body.data.id}`);

      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body.success).toBe(true);
      expect(deleteRes.body.data).toBeUndefined();

      const listRes = await request(app)
        .get(`/api/projects/${projectId}/outlines`);
      expect(listRes.body.data).toHaveLength(0);
    });

    it('should return 404 for non-existent outline', async () => {
      const projectId = await createProject();

      const res = await request(app)
        .delete(`/api/projects/${projectId}/outlines/nonexistent-id`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('should reassign children to grandparent when deleting parent', async () => {
      const projectId = await createProject();

      const grandparentRes = await request(app)
        .post(`/api/projects/${projectId}/outlines`)
        .send({ title: 'Grandparent' });
      const grandparentId = grandparentRes.body.data.id;

      const parentRes = await request(app)
        .post(`/api/projects/${projectId}/outlines`)
        .send({ title: 'Parent', parentId: grandparentId });
      const parentId = parentRes.body.data.id;

      const childRes = await request(app)
        .post(`/api/projects/${projectId}/outlines`)
        .send({ title: 'Child', parentId });
      const childId = childRes.body.data.id;

      await request(app)
        .delete(`/api/projects/${projectId}/outlines/${parentId}`);

      const childGet = await request(app)
        .get(`/api/projects/${projectId}/outlines/${childId}`);

      expect(childGet.status).toBe(200);
      expect(childGet.body.data.outline.parent_id).toBe(grandparentId);
    });

    it('should reassign children to null when deleting a root-level parent', async () => {
      const projectId = await createProject();

      const parentRes = await request(app)
        .post(`/api/projects/${projectId}/outlines`)
        .send({ title: 'Root Parent' });
      const parentId = parentRes.body.data.id;

      const childRes = await request(app)
        .post(`/api/projects/${projectId}/outlines`)
        .send({ title: 'Orphaned Child', parentId });
      const childId = childRes.body.data.id;

      await request(app)
        .delete(`/api/projects/${projectId}/outlines/${parentId}`);

      const childGet = await request(app)
        .get(`/api/projects/${projectId}/outlines/${childId}`);

      expect(childGet.status).toBe(200);
      expect(childGet.body.data.outline.parent_id).toBeNull();
    });
  });

  describe('Nested outlines (parent/child)', () => {
    it('should create a two-level hierarchy', async () => {
      const projectId = await createProject();

      const parent = await request(app)
        .post(`/api/projects/${projectId}/outlines`)
        .send({ title: 'Act 1', level: 0 });

      const child = await request(app)
        .post(`/api/projects/${projectId}/outlines`)
        .send({ title: 'Scene 1', level: 1, parentId: parent.body.data.id });

      expect(child.body.data.parent_id).toBe(parent.body.data.id);
      expect(child.body.data.level).toBe(1);
    });

    it('should retrieve children via GET single outline', async () => {
      const projectId = await createProject();

      const parent = await request(app)
        .post(`/api/projects/${projectId}/outlines`)
        .send({ title: 'Parent' });

      await request(app)
        .post(`/api/projects/${projectId}/outlines`)
        .send({ title: 'Child A', parentId: parent.body.data.id, level: 1 });
      await request(app)
        .post(`/api/projects/${projectId}/outlines`)
        .send({ title: 'Child B', parentId: parent.body.data.id, level: 1 });

      const res = await request(app)
        .get(`/api/projects/${projectId}/outlines/${parent.body.data.id}`);

      expect(res.body.data.children).toHaveLength(2);
      const childTitles = res.body.data.children.map((c: any) => c.title);
      expect(childTitles).toContain('Child A');
      expect(childTitles).toContain('Child B');
    });

    it('should create a three-level hierarchy', async () => {
      const projectId = await createProject();

      const l0 = await request(app)
        .post(`/api/projects/${projectId}/outlines`)
        .send({ title: 'Act', level: 0 });

      const l1 = await request(app)
        .post(`/api/projects/${projectId}/outlines`)
        .send({ title: 'Scene', level: 1, parentId: l0.body.data.id });

      const l2 = await request(app)
        .post(`/api/projects/${projectId}/outlines`)
        .send({ title: 'Beat', level: 2, parentId: l1.body.data.id });

      expect(l2.body.data.parent_id).toBe(l1.body.data.id);

      const l1Detail = await request(app)
        .get(`/api/projects/${projectId}/outlines/${l1.body.data.id}`);

      expect(l1Detail.body.data.outline.parent_id).toBe(l0.body.data.id);
      expect(l1Detail.body.data.children).toHaveLength(1);
      expect(l1Detail.body.data.children[0].title).toBe('Beat');
    });

    it('should move a child to a different parent via update', async () => {
      const projectId = await createProject();

      const parentA = await request(app)
        .post(`/api/projects/${projectId}/outlines`)
        .send({ title: 'Parent A' });
      const parentB = await request(app)
        .post(`/api/projects/${projectId}/outlines`)
        .send({ title: 'Parent B' });
      const child = await request(app)
        .post(`/api/projects/${projectId}/outlines`)
        .send({ title: 'Movable Child', parentId: parentA.body.data.id });

      const updated = await request(app)
        .put(`/api/projects/${projectId}/outlines/${child.body.data.id}`)
        .send({ parent_id: parentB.body.data.id });

      expect(updated.status).toBe(200);
      expect(updated.body.data.parent_id).toBe(parentB.body.data.id);

      const parentADetail = await request(app)
        .get(`/api/projects/${projectId}/outlines/${parentA.body.data.id}`);
      expect(parentADetail.body.data.children).toHaveLength(0);

      const parentBDetail = await request(app)
        .get(`/api/projects/${projectId}/outlines/${parentB.body.data.id}`);
      expect(parentBDetail.body.data.children).toHaveLength(1);
      expect(parentBDetail.body.data.children[0].title).toBe('Movable Child');
    });

    it('should list all outlines including nested ones', async () => {
      const projectId = await createProject();

      const parent = await request(app)
        .post(`/api/projects/${projectId}/outlines`)
        .send({ title: 'Root', level: 0 });

      await request(app)
        .post(`/api/projects/${projectId}/outlines`)
        .send({ title: 'Nested', level: 1, parentId: parent.body.data.id });

      const res = await request(app)
        .get(`/api/projects/${projectId}/outlines`);

      expect(res.body.data).toHaveLength(2);
    });
  });

  describe('Full CRUD workflow', () => {
    it('should create, read, update, and delete an outline', async () => {
      const projectId = await createProject();

      const createRes = await request(app)
        .post(`/api/projects/${projectId}/outlines`)
        .send({ title: 'Full Lifecycle', content: 'Initial content' });

      expect(createRes.status).toBe(201);
      const outlineId = createRes.body.data.id;

      const getRes = await request(app)
        .get(`/api/projects/${projectId}/outlines/${outlineId}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body.data.outline.title).toBe('Full Lifecycle');
      expect(getRes.body.data.outline.content).toBe('Initial content');

      const listRes = await request(app)
        .get(`/api/projects/${projectId}/outlines`);

      expect(listRes.body.data).toHaveLength(1);

      const updateRes = await request(app)
        .put(`/api/projects/${projectId}/outlines/${outlineId}`)
        .send({ title: 'Updated Lifecycle', content: 'New content', level: 3 });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.title).toBe('Updated Lifecycle');
      expect(updateRes.body.data.content).toBe('New content');
      expect(updateRes.body.data.level).toBe(3);

      const verifyRes = await request(app)
        .get(`/api/projects/${projectId}/outlines/${outlineId}`);

      expect(verifyRes.body.data.outline.title).toBe('Updated Lifecycle');
      expect(verifyRes.body.data.outline.level).toBe(3);

      const deleteRes = await request(app)
        .delete(`/api/projects/${projectId}/outlines/${outlineId}`);

      expect(deleteRes.status).toBe(200);

      const goneRes = await request(app)
        .get(`/api/projects/${projectId}/outlines/${outlineId}`);

      expect(goneRes.status).toBe(404);
    });
  });
});
