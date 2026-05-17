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

describe('Writing Stats API', () => {
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
      ensureProjectDir: vi.fn(), deleteProjectDir: vi.fn(),
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

  it('returns overview with no data', async () => {
    testDb.prepare(`INSERT INTO projects (id, name) VALUES (?, ?)`).run('p1', '测试');
    const res = await request(app).get('/api/projects/p1/writing-stats/overview');
    expect(res.status).toBe(200);
    expect(res.body.data.totalWords).toBe(0);
    expect(res.body.data.longestStreak).toBe(0);
  });

  it('computes overview from daily_stats', async () => {
    testDb.prepare(`INSERT INTO projects (id, name) VALUES (?, ?)`).run('p1', '测试');
    testDb.prepare(`INSERT INTO daily_stats (id, project_id, date, words_added, words_total) VALUES (?, ?, ?, ?, ?)`)
      .run('s1', 'p1', '2026-05-10', 1000, 1000);
    testDb.prepare(`INSERT INTO daily_stats (id, project_id, date, words_added, words_total) VALUES (?, ?, ?, ?, ?)`)
      .run('s2', 'p1', '2026-05-11', 500, 1500);

    const res = await request(app).get('/api/projects/p1/writing-stats/overview');
    expect(res.status).toBe(200);
    expect(res.body.data.totalWords).toBe(1500);
    expect(res.body.data.totalDays).toBe(2);
    expect(res.body.data.avgDailyWords).toBe(750);
  });

  it('returns trend data for week period', async () => {
    testDb.prepare(`INSERT INTO projects (id, name) VALUES (?, ?)`).run('p1', '测试');
    testDb.prepare(`INSERT INTO daily_stats (id, project_id, date, words_added, words_total) VALUES (?, ?, ?, ?, ?)`)
      .run('s1', 'p1', '2026-05-10', 1000, 1000);
    testDb.prepare(`INSERT INTO daily_stats (id, project_id, date, words_added, words_total) VALUES (?, ?, ?, ?, ?)`)
      .run('s2', 'p1', '2026-05-11', 500, 1500);

    const res = await request(app).get('/api/projects/p1/writing-stats/trend?period=week');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
  });

  it('returns heatmap with 24 hours', async () => {
    testDb.prepare(`INSERT INTO projects (id, name) VALUES (?, ?)`).run('p1', '测试');
    testDb.prepare(`INSERT INTO chapters (id, project_id, title, file_path, sort_order) VALUES (?, ?, ?, ?, 0)`)
      .run('ch1', 'p1', '第一章', 'p1/chapters/ch1.md');
    testDb.prepare(`INSERT INTO writing_sessions (id, project_id, chapter_id, started_at, duration_ms) VALUES (?, ?, ?, ?, ?)`)
      .run('ws1', 'p1', 'ch1', '2026-05-10T10:00:00', 300000);

    const res = await request(app).get('/api/projects/p1/writing-stats/heatmap');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(24);
  });
});
