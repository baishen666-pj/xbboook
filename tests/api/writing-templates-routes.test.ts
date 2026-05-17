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
    CREATE TABLE writing_templates (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, name TEXT NOT NULL,
      category TEXT DEFAULT 'general', description TEXT, content TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
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

describe('Writing Templates API', () => {
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

  it('lists empty templates', async () => {
    testDb.prepare(`INSERT INTO projects (id, name) VALUES (?, ?)`).run('p1', '测试');
    const res = await request(app).get('/api/projects/p1/writing-templates');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });

  it('creates a template', async () => {
    testDb.prepare(`INSERT INTO projects (id, name) VALUES (?, ?)`).run('p1', '测试');
    const res = await request(app).post('/api/projects/p1/writing-templates')
      .send({ name: '开篇模板', category: 'opening', content: '第一章 {{title}}\n\n{{content}}', description: '标准开篇' });
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('开篇模板');
    expect(res.body.data.category).toBe('opening');
  });

  it('lists templates after creation', async () => {
    testDb.prepare(`INSERT INTO projects (id, name) VALUES (?, ?)`).run('p1', '测试');
    testDb.prepare(`INSERT INTO writing_templates (id, project_id, name, category, content) VALUES (?, ?, ?, ?, ?)`)
      .run('t1', 'p1', '模板1', 'opening', '内容1');
    testDb.prepare(`INSERT INTO writing_templates (id, project_id, name, category, content) VALUES (?, ?, ?, ?, ?)`)
      .run('t2', 'p1', '模板2', 'climax', '内容2');

    const res = await request(app).get('/api/projects/p1/writing-templates');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
  });

  it('updates a template', async () => {
    testDb.prepare(`INSERT INTO projects (id, name) VALUES (?, ?)`).run('p1', '测试');
    testDb.prepare(`INSERT INTO writing_templates (id, project_id, name, category, content) VALUES (?, ?, ?, ?, ?)`)
      .run('t1', 'p1', '旧名', 'general', '旧内容');

    const res = await request(app).put('/api/projects/p1/writing-templates/t1')
      .send({ name: '新名', content: '新内容' });
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('新名');
  });

  it('deletes a template', async () => {
    testDb.prepare(`INSERT INTO projects (id, name) VALUES (?, ?)`).run('p1', '测试');
    testDb.prepare(`INSERT INTO writing_templates (id, project_id, name, category, content) VALUES (?, ?, ?, ?, ?)`)
      .run('t1', 'p1', '模板1', 'general', '内容');

    const res = await request(app).delete('/api/projects/p1/writing-templates/t1');
    expect(res.status).toBe(200);

    const list = await request(app).get('/api/projects/p1/writing-templates');
    expect(list.body.data).toHaveLength(0);
  });
});
