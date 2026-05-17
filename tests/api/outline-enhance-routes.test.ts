import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import Database from 'better-sqlite3';

let testDb: Database.Database;
let app: any;
let mockChatFn: ReturnType<typeof vi.fn>;

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
  `);
  return db;
}

describe('Outline Enhance API', () => {
  beforeEach(async () => {
    mockChatFn = vi.fn();

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
      ensureProjectDir: vi.fn(),
      deleteProjectDir: vi.fn(),
    }));
    vi.doMock('../../server/ai/providers.js', () => ({
      getProvider: () => ({ chat: mockChatFn }),
    }));
    vi.doMock('../../server/ai/configStore.js', () => ({
      getConfig: () => ({ provider: 'openai', model: 'gpt-4' }),
    }));

    const mod = await import('../../server/app.js');
    app = mod.default;
  });

  afterEach(() => {
    vi.doUnmock('../../server/db/database.js');
    vi.doUnmock('../../server/ws/presenceManager.js');
    vi.doUnmock('../../server/services/analyticsService.js');
    vi.doUnmock('../../server/services/fileService.js');
    vi.doUnmock('../../server/ai/providers.js');
    vi.doUnmock('../../server/ai/configStore.js');
    vi.restoreAllMocks();
    if (testDb) testDb.close();
  });

  async function createProject(id = 'proj1') {
    testDb.prepare(
      `INSERT INTO projects (id, name) VALUES (?, ?)`
    ).run(id, `测试项目-${id}`);
  }

  async function createOutline(id: string, projectId: string, title: string, level = 0, parentId: string | null = null) {
    testDb.prepare(
      `INSERT INTO outlines (id, project_id, title, level, parent_id, sort_order) VALUES (?, ?, ?, ?, ?, 0)`
    ).run(id, projectId, title, level, parentId);
  }

  describe('POST /expand', () => {
    it('returns 404 for non-existent outline', async () => {
      await createProject();
      const res = await request(app)
        .post('/api/projects/proj1/outline-enhance/expand')
        .send({ outlineId: 'nonexist' });
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('expands an outline node and creates children', async () => {
      mockChatFn.mockResolvedValue({
        content: JSON.stringify({
          children: [
            { title: '子节点1', summary: '子节点1描述' },
            { title: '子节点2', summary: '子节点2描述' },
          ],
          expansion_notes: '扩展说明',
        }),
      });

      await createProject();
      await createOutline('o1', 'proj1', '第一卷');

      const res = await request(app)
        .post('/api/projects/proj1/outline-enhance/expand')
        .send({ outlineId: 'o1' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.created).toHaveLength(2);
      expect(res.body.data.created[0].title).toBe('子节点1');
      expect(res.body.data.notes).toBe('扩展说明');
    });

    it('handles malformed AI response', async () => {
      mockChatFn.mockResolvedValue({ content: 'not valid json' });

      await createProject();
      await createOutline('o1', 'proj1', '第一卷');

      const res = await request(app)
        .post('/api/projects/proj1/outline-enhance/expand')
        .send({ outlineId: 'o1' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('AI 返回格式异常');
    });

    it('rejects invalid body', async () => {
      await createProject();
      const res = await request(app)
        .post('/api/projects/proj1/outline-enhance/expand')
        .send({});
      expect(res.status).toBe(400);
    });

    it('passes custom instruction', async () => {
      mockChatFn.mockResolvedValue({
        content: JSON.stringify({
          children: [{ title: '自定义节点', summary: '自定义描述' }],
          expansion_notes: '',
        }),
      });

      await createProject();
      await createOutline('o1', 'proj1', '第一卷');

      const res = await request(app)
        .post('/api/projects/proj1/outline-enhance/expand')
        .send({ outlineId: 'o1', customInstruction: '增加感情线' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.created).toHaveLength(1);
    });
  });

  describe('POST /template', () => {
    it('generates an outline template', async () => {
      mockChatFn.mockResolvedValue({
        content: JSON.stringify({
          title: '玄幻大纲',
          children: [
            { title: '开局', summary: '主角觉醒' },
            { title: '发展', summary: '修炼升级' },
            { title: '高潮', summary: '大战Boss' },
          ],
        }),
      });

      const res = await request(app)
        .post('/api/projects/proj1/outline-enhance/template')
        .send({ genre: '玄幻' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('玄幻大纲');
      expect(res.body.data.children).toHaveLength(3);
    });

    it('rejects missing genre', async () => {
      const res = await request(app)
        .post('/api/projects/proj1/outline-enhance/template')
        .send({});
      expect(res.status).toBe(400);
    });

    it('handles malformed AI response for template', async () => {
      mockChatFn.mockResolvedValue({ content: 'not json' });

      const res = await request(app)
        .post('/api/projects/proj1/outline-enhance/template')
        .send({ genre: '仙侠' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('AI 返回格式异常');
    });
  });

  describe('POST /analyze', () => {
    it('returns early for empty project', async () => {
      await createProject();

      const res = await request(app)
        .post('/api/projects/proj1/outline-enhance/analyze')
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.overall_score).toBe(0);
      expect(res.body.data.message).toBe('项目尚无大纲内容');
    });

    it('analyzes outline structure', async () => {
      mockChatFn.mockResolvedValue({
        content: JSON.stringify({
          overall_score: 75,
          completeness: 80,
          pacing_score: 70,
          conflict_density: 65,
          character_arc_coverage: 60,
          strengths: ['结构清晰'],
          weaknesses: ['冲突不够'],
          suggestions: ['增加转折'],
        }),
      });

      await createProject();
      await createOutline('o1', 'proj1', '第一卷');
      await createOutline('o2', 'proj1', '第一章', 1, 'o1');

      const res = await request(app)
        .post('/api/projects/proj1/outline-enhance/analyze')
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.overall_score).toBe(75);
      expect(res.body.data.strengths).toContain('结构清晰');
      expect(res.body.data.suggestions).toContain('增加转折');
    });

  });
});
