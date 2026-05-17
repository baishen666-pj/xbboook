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
    CREATE TABLE outlines (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, level INTEGER DEFAULT 0,
      parent_id TEXT, target_ref_id TEXT, title TEXT NOT NULL, content TEXT,
      sort_order INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (parent_id) REFERENCES outlines(id) ON DELETE CASCADE
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
    CREATE TABLE search_cache (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, content TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE chapter_search_cache (
      chapter_id TEXT PRIMARY KEY, project_id TEXT NOT NULL, plain_text TEXT,
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
  `);
  return db;
}

describe('Chapter Operations API', () => {
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
      addConnection: vi.fn(), removeConnection: vi.fn(), getOnlineUsers: () => [],
      broadcastToProject: vi.fn(),
    }));
    vi.doMock('../../server/services/analyticsService.js', () => ({
      getDashboardData: () => ({
        summary: { totalWords: 0, totalDays: 0, avgDaily: 0, bestDay: null },
        velocity: [], chapterStatus: [],
        streak: { current: 0, longest: 0 },
        target: { target: 0, current: 0, percentage: 0 },
        peakHours: Array.from({ length: 24 }, (_, h) => ({ hour: h, count: 0 })),
      }),
      getCharacterAppearances: async () => [],
    }));
    vi.doMock('../../server/services/fileService.js', () => ({
      ensureProjectDir: vi.fn(),
      deleteProjectDir: vi.fn(),
      readChapter: vi.fn().mockResolvedValue('这是第一章的内容，很长很长的文字，继续写下去。'),
      writeChapter: vi.fn().mockResolvedValue(undefined),
      deleteChapter: vi.fn().mockResolvedValue(undefined),
    }));

    const mod = await import('../../server/app.js');
    app = mod.default;
  });

  afterEach(() => {
    vi.doUnmock('../../server/db/database.js');
    vi.doUnmock('../../server/ws/presenceManager.js');
    vi.doUnmock('../../server/services/analyticsService.js');
    vi.doUnmock('../../server/services/fileService.js');
    vi.restoreAllMocks();
    if (testDb) testDb.close();
  });

  it('splits a chapter at given points', async () => {
    testDb.prepare(`INSERT INTO projects (id, name) VALUES (?, ?)`).run('p1', '测试');
    testDb.prepare(`INSERT INTO chapters (id, project_id, title, file_path, sort_order) VALUES (?, ?, ?, ?, 0)`)
      .run('ch1', 'p1', '长章节', 'p1/chapters/ch1.md');

    const res = await request(app)
      .post('/api/projects/p1/chapter-ops/split')
      .send({ chapterId: 'ch1', splitPoints: [10, 20] });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.splitCount).toBe(3);
  });

  it('rejects split point beyond text length', async () => {
    testDb.prepare(`INSERT INTO projects (id, name) VALUES (?, ?)`).run('p1', '测试');
    testDb.prepare(`INSERT INTO chapters (id, project_id, title, file_path, sort_order) VALUES (?, ?, ?, ?, 0)`)
      .run('ch1', 'p1', '长章节', 'p1/chapters/ch1.md');

    const res = await request(app)
      .post('/api/projects/p1/chapter-ops/split')
      .send({ chapterId: 'ch1', splitPoints: [99999] });

    expect(res.status).toBe(400);
  });

  it('returns 404 for non-existent chapter on split', async () => {
    testDb.prepare(`INSERT INTO projects (id, name) VALUES (?, ?)`).run('p1', '测试');
    const res = await request(app)
      .post('/api/projects/p1/chapter-ops/split')
      .send({ chapterId: 'nonexist', splitPoints: [100] });
    expect(res.status).toBe(404);
  });

  it('merges multiple chapters', async () => {
    testDb.prepare(`INSERT INTO projects (id, name) VALUES (?, ?)`).run('p1', '测试');
    testDb.prepare(`INSERT INTO chapters (id, project_id, title, file_path, sort_order) VALUES (?, ?, ?, ?, 0)`)
      .run('ch1', 'p1', '第一章', 'p1/chapters/ch1.md');
    testDb.prepare(`INSERT INTO chapters (id, project_id, title, file_path, sort_order) VALUES (?, ?, ?, ?, 1)`)
      .run('ch2', 'p1', '第二章', 'p1/chapters/ch2.md');

    const res = await request(app)
      .post('/api/projects/p1/chapter-ops/merge')
      .send({ chapterIds: ['ch1', 'ch2'], title: '合并章' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.mergedCount).toBe(2);
    expect(res.body.data.title).toBe('合并章');
  });

  it('rejects merging less than 2 chapters', async () => {
    const res = await request(app)
      .post('/api/projects/p1/chapter-ops/merge')
      .send({ chapterIds: ['ch1'] });
    expect(res.status).toBe(400);
  });

  it('rejects invalid body', async () => {
    const res = await request(app)
      .post('/api/projects/p1/chapter-ops/split')
      .send({});
    expect(res.status).toBe(400);
  });
});
