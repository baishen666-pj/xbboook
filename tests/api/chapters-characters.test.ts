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

describe('Chapters API', () => {
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
    const chapterContentStore = new Map<string, string>();
    vi.doMock('../../server/services/fileService.js', () => ({
      readChapter: vi.fn(async (pid: string, cid: string) => chapterContentStore.get(`${pid}/${cid}`) ?? ''),
      writeChapter: vi.fn(async (pid: string, cid: string, content: string) => { chapterContentStore.set(`${pid}/${cid}`, content); }),
      writeVersion: vi.fn(),
      readVersion: vi.fn().mockResolvedValue(''),
      deleteVersionFile: vi.fn(),
      deleteVersionDir: vi.fn(),
      ensureProjectDir: vi.fn(),
      deleteProjectDir: vi.fn(),
      deleteChapter: vi.fn(async (pid: string, cid: string) => { chapterContentStore.delete(`${pid}/${cid}`); }),
    }));
    const mod = await import('../../server/app.js');
    app = mod.default;

    const res = await request(app).post('/api/projects').send({ name: 'Chapter Tests' });
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

  it('should create a chapter', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/chapters`)
      .send({ title: 'Chapter 1' });

    expect(res.status).toBe(201);
    expect(res.body.data.title).toBe('Chapter 1');
  });

  it('should list chapters', async () => {
    await request(app).post(`/api/projects/${projectId}/chapters`).send({ title: 'Ch A' });
    await request(app).post(`/api/projects/${projectId}/chapters`).send({ title: 'Ch B' });

    const res = await request(app).get(`/api/projects/${projectId}/chapters`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
  });

  it('should save and read chapter content', async () => {
    const create = await request(app)
      .post(`/api/projects/${projectId}/chapters`)
      .send({ title: 'Content Ch' });
    const chId = create.body.data.id;

    const save = await request(app)
      .put(`/api/projects/${projectId}/chapters/${chId}/content`)
      .send({ content: 'Hello world, this is test content.' });

    expect(save.status).toBe(200);
    expect(save.body.data.word_count).toBeGreaterThan(0);

    const read = await request(app).get(`/api/projects/${projectId}/chapters/${chId}`);
    expect(read.body.data.content).toBe('Hello world, this is test content.');
  });

  it('should reorder chapters', async () => {
    const a = await request(app).post(`/api/projects/${projectId}/chapters`).send({ title: 'A' });
    const b = await request(app).post(`/api/projects/${projectId}/chapters`).send({ title: 'B' });

    const res = await request(app)
      .put(`/api/projects/${projectId}/chapters/reorder`)
      .send({ items: [{ id: b.body.data.id, sortOrder: 0 }, { id: a.body.data.id, sortOrder: 1 }] });

    expect(res.status).toBe(200);
  });

  it('should delete a chapter', async () => {
    const create = await request(app)
      .post(`/api/projects/${projectId}/chapters`)
      .send({ title: 'Delete Me' });
    const chId = create.body.data.id;

    const res = await request(app).delete(`/api/projects/${projectId}/chapters/${chId}`);
    expect(res.status).toBe(200);
  });
});

describe('Characters API', () => {
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

    const res = await request(app).post('/api/projects').send({ name: 'Char Tests' });
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

  it('should create a character with full fields', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/characters`)
      .send({
        name: 'Li Ming',
        nickname: 'Xiao Ming',
        roleType: 'protagonist',
        gender: 'male',
        personality: 'brave and kind',
        abilities: 'swordsmanship',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('Li Ming');
    expect(res.body.data.nickname).toBe('Xiao Ming');
    expect(res.body.data.role_type).toBe('protagonist');
  });

  it('should list characters with relations', async () => {
    const res = await request(app).get(`/api/projects/${projectId}/characters`);

    expect(res.status).toBe(200);
    expect(res.body.data.characters).toBeDefined();
    expect(res.body.data.relations).toBeDefined();
  });

  it('should update a character', async () => {
    const create = await request(app)
      .post(`/api/projects/${projectId}/characters`)
      .send({ name: 'Before' });
    const id = create.body.data.id;

    const res = await request(app)
      .put(`/api/projects/${projectId}/characters/${id}`)
      .send({ name: 'After', personality: 'changed' });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('After');
  });

  it('should create a relation between characters', async () => {
    const a = await request(app).post(`/api/projects/${projectId}/characters`).send({ name: 'A' });
    const b = await request(app).post(`/api/projects/${projectId}/characters`).send({ name: 'B' });

    const res = await request(app)
      .post(`/api/projects/${projectId}/characters/relations`)
      .send({ characterAId: a.body.data.id, characterBId: b.body.data.id, relationType: 'friend', description: 'best friends' });

    expect(res.status).toBe(201);
    expect(res.body.data.relation_type).toBe('friend');
  });

  it('should delete a character', async () => {
    const create = await request(app)
      .post(`/api/projects/${projectId}/characters`)
      .send({ name: 'Delete Me' });
    const id = create.body.data.id;

    const res = await request(app).delete(`/api/projects/${projectId}/characters/${id}`);
    expect(res.status).toBe(200);
  });
});
