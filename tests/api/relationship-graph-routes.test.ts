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
    CREATE TABLE chapters (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, volume_id TEXT, title TEXT NOT NULL,
      summary TEXT, word_count INTEGER DEFAULT 0, file_path TEXT NOT NULL,
      status TEXT DEFAULT 'draft', sort_order INTEGER DEFAULT 0, tags TEXT DEFAULT '[]',
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (volume_id) REFERENCES volumes(id) ON DELETE SET NULL
    );
    CREATE TABLE volumes (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, title TEXT NOT NULL, summary TEXT,
      sort_order INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
    CREATE TABLE characters (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, name TEXT NOT NULL, nickname TEXT,
      role_type TEXT DEFAULT 'supporting', gender TEXT, age TEXT, appearance TEXT,
      personality TEXT, background TEXT, abilities TEXT, notes TEXT,
      sort_order INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
  `);
  return db;
}

describe('Relationship Graph API', () => {
  beforeEach(async () => {
    testDb = createTestDb();
    vi.doMock('../../server/db/database.js', () => ({
      getDb: () => testDb, closeDb: () => {},
    }));
    vi.doMock('../../server/ws/presenceManager.js', () => ({
      generateToken: (uid: string) => `test-token-${uid}`,
      validateToken: (t: string) => { const m = t.match(/^test-token-(.+)$/); return m ? m[1] : null; },
      addConnection: vi.fn(), removeConnection: vi.fn(), getOnlineUsers: () => [], broadcastToProject: vi.fn(),
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
    vi.doMock('../../server/services/fileService.js', () => ({
      ensureProjectDir: vi.fn(), deleteProjectDir: vi.fn(), readChapter: async () => '',
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

  it('returns empty graph for project with no characters', async () => {
    testDb.prepare(`INSERT INTO projects (id, name) VALUES (?, ?)`).run('p1', '测试');
    const res = await request(app).get('/api/projects/p1/relationship-graph');
    expect(res.status).toBe(200);
    expect(res.body.data.nodes).toHaveLength(0);
    expect(res.body.data.edges).toHaveLength(0);
  });

  it('returns nodes for project characters', async () => {
    testDb.prepare(`INSERT INTO projects (id, name) VALUES (?, ?)`).run('p1', '测试');
    testDb.prepare(`INSERT INTO characters (id, project_id, name, role_type) VALUES (?, ?, ?, ?)`)
      .run('c1', 'p1', '张三', 'protagonist');
    testDb.prepare(`INSERT INTO characters (id, project_id, name, role_type) VALUES (?, ?, ?, ?)`)
      .run('c2', 'p1', '李四', 'antagonist');

    const res = await request(app).get('/api/projects/p1/relationship-graph');
    expect(res.status).toBe(200);
    expect(res.body.data.nodes).toHaveLength(2);
    expect(res.body.data.nodes[0].name).toBe('张三');
  });

  it('returns empty graph for non-existent project', async () => {
    const res = await request(app).get('/api/projects/nonexist/relationship-graph');
    expect(res.status).toBe(200);
    expect(res.body.data.nodes).toHaveLength(0);
  });
});
