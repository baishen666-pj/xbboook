import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import Database from 'better-sqlite3';

let testDb: Database.Database;
let app: any;
const chapterContentStore = new Map<string, string>();

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

function setupMocks() {
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
}

function teardownMocks() {
  vi.doUnmock('../../server/db/database.js');
  vi.doUnmock('../../server/ws/presenceManager.js');
  vi.doUnmock('../../server/services/analyticsService.js');
  vi.doUnmock('../../server/services/fileService.js');
  vi.restoreAllMocks();
  if (testDb) testDb.close();
}

describe('Worldviews API', () => {
  let projectId: string;

  beforeEach(async () => {
    testDb = createTestDb();
    setupMocks();
    const mod = await import('../../server/app.js');
    app = mod.default;

    const res = await request(app).post('/api/projects').send({ name: 'WV Tests' });
    projectId = res.body.data.id;
  });

  afterEach(() => {
    teardownMocks();
  });

  it('should create a worldview entry', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/worldviews`)
      .send({ category: 'power', title: 'Qi System', content: 'Nine levels of qi cultivation' });

    expect(res.status).toBe(201);
    expect(res.body.data.category).toBe('power');
    expect(res.body.data.title).toBe('Qi System');
  });

  it('should list worldviews with categories', async () => {
    await request(app).post(`/api/projects/${projectId}/worldviews`)
      .send({ category: 'power', title: 'Qi System' });
    await request(app).post(`/api/projects/${projectId}/worldviews`)
      .send({ category: 'geography', title: 'Mountains' });

    const res = await request(app).get(`/api/projects/${projectId}/worldviews`);

    expect(res.status).toBe(200);
    expect(res.body.data.items.length).toBeGreaterThanOrEqual(2);
    expect(res.body.data.categories).toContain('power');
    expect(res.body.data.categories).toContain('geography');
  });

  it('should filter by category', async () => {
    await request(app).post(`/api/projects/${projectId}/worldviews`)
      .send({ category: 'power', title: 'Qi System' });
    await request(app).post(`/api/projects/${projectId}/worldviews`)
      .send({ category: 'geography', title: 'Mountains' });

    const res = await request(app).get(`/api/projects/${projectId}/worldviews?category=power`);

    expect(res.status).toBe(200);
    expect(res.body.data.every((w: any) => w.category === 'power')).toBe(true);
  });

  it('should update a worldview', async () => {
    const create = await request(app).post(`/api/projects/${projectId}/worldviews`)
      .send({ category: 'test', title: 'Before' });
    const id = create.body.data.id;

    const res = await request(app).put(`/api/projects/${projectId}/worldviews/${id}`)
      .send({ title: 'After', content: 'updated' });

    expect(res.body.data.title).toBe('After');
  });

  it('should delete a worldview', async () => {
    const create = await request(app).post(`/api/projects/${projectId}/worldviews`)
      .send({ category: 'del', title: 'Bye' });

    const res = await request(app).delete(`/api/projects/${projectId}/worldviews/${create.body.data.id}`);
    expect(res.status).toBe(200);
  });

  it('should reject missing fields', async () => {
    const res = await request(app).post(`/api/projects/${projectId}/worldviews`)
      .send({ title: 'No Category' });

    expect(res.status).toBe(400);
  });
});

describe('Outlines API', () => {
  let projectId: string;

  beforeEach(async () => {
    testDb = createTestDb();
    setupMocks();
    const mod = await import('../../server/app.js');
    app = mod.default;

    const res = await request(app).post('/api/projects').send({ name: 'Outline Tests' });
    projectId = res.body.data.id;
  });

  afterEach(() => {
    teardownMocks();
  });

  it('should create outline nodes', async () => {
    const root = await request(app).post(`/api/projects/${projectId}/outlines`)
      .send({ title: 'Act 1', level: 0, content: 'Introduction' });

    expect(root.status).toBe(201);
    expect(root.body.data.level).toBe(0);

    const child = await request(app).post(`/api/projects/${projectId}/outlines`)
      .send({ title: 'Scene 1', level: 1, parentId: root.body.data.id });

    expect(child.status).toBe(201);
  });

  it('should list outlines sorted by level', async () => {
    await request(app).post(`/api/projects/${projectId}/outlines`)
      .send({ title: 'Act 1', level: 0, content: 'Introduction' });
    await request(app).post(`/api/projects/${projectId}/outlines`)
      .send({ title: 'Scene 1', level: 1 });

    const res = await request(app).get(`/api/projects/${projectId}/outlines`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
  });

  it('should update an outline node', async () => {
    const create = await request(app).post(`/api/projects/${projectId}/outlines`)
      .send({ title: 'Before' });

    const res = await request(app).put(`/api/projects/${projectId}/outlines/${create.body.data.id}`)
      .send({ title: 'After', content: 'Updated content' });

    expect(res.body.data.title).toBe('After');
  });

  it('should delete and reassign children', async () => {
    const parent = await request(app).post(`/api/projects/${projectId}/outlines`)
      .send({ title: 'Parent', level: 0 });
    const child = await request(app).post(`/api/projects/${projectId}/outlines`)
      .send({ title: 'Child', level: 1, parentId: parent.body.data.id });

    // Delete parent
    await request(app).delete(`/api/projects/${projectId}/outlines/${parent.body.data.id}`);

    // Child should still exist
    const all = await request(app).get(`/api/projects/${projectId}/outlines`);
    const childExists = all.body.data.some((o: any) => o.id === child.body.data.id);
    expect(childExists).toBe(true);
  });
});

describe('AI API', () => {
  beforeEach(async () => {
    testDb = createTestDb();
    setupMocks();
    // Mock AI service modules to avoid real API calls
    vi.doMock('../../server/services/aiService.js', () => ({
      isConfigured: () => false,
      listSkills: () => {
        const ids = ['continue', 'rewrite', 'polish', 'deai', 'style', 'dialogue', 'consistency', 'consistency-scan', 'inspiration', 'qa', 'plot-planning', 'chapter-summary', 'writing-advice', 'character-design', 'chapter-generate'];
        return ids.map((id, i) => ({ id, name: `Skill ${i}`, description: `Desc ${i}`, icon: 'p', systemPrompt: 'sp', needsSelection: false, temperature: 0.8, maxTokens: 4096 }));
      },
      getSkill: (id: string) => {
        const skills: Record<string, any> = {
          continue: { id: 'continue', name: '续写', needsSelection: false, temperature: 0.85, maxTokens: 2048 },
          deai: { id: 'deai', name: '去AI味', needsSelection: true, temperature: 0.7, maxTokens: 4096 },
          'consistency-scan': { id: 'consistency-scan', name: '一致性扫描', needsSelection: false, temperature: 0.3, maxTokens: 2048 },
          'chapter-generate': { id: 'chapter-generate', name: '章节生成', needsSelection: false, temperature: 0.8, maxTokens: 4096 },
        };
        return skills[id] || undefined;
      },
      processAiRequest: async function* () { yield { type: 'done' as const, content: 'mock' }; },
    }));
    vi.doMock('../../server/ai/agentFactory.js', () => ({
      getConfig: () => ({ provider: 'deepseek', apiKey: '', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat', temperature: 0.8, maxTokens: 4096 }),
      isConfigured: () => false,
      streamChat: async function* () { yield { content: '', done: true }; },
    }));
    vi.doMock('../../server/ai/configStore.js', () => ({
      isConfigured: () => false,
      loadStoredConfig: () => ({ provider: 'deepseek', apiKey: '', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat', temperature: 0.8, maxTokens: 4096 }),
      saveConfig: (updates: any) => {
        const base = { provider: 'deepseek', apiKey: '', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat', temperature: 0.8, maxTokens: 4096 };
        return { ...base, ...updates };
      },
    }));
    vi.doMock('../../server/ai/providers.js', () => ({
      PROVIDERS: [
        { id: 'deepseek', name: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', defaultModel: 'deepseek-chat', models: ['deepseek-chat'] },
        { id: 'qwen', name: '通义千问', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', defaultModel: 'qwen-plus', models: ['qwen-plus'] },
        { id: 'moonshot', name: 'Moonshot', baseUrl: 'https://api.moonshot.cn/v1', defaultModel: 'moonshot-v1-8k', models: ['moonshot-v1-8k'] },
        { id: 'openai', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-4o-mini', models: ['gpt-4o-mini'] },
      ],
      getProvider: (id: string) => {
        const providers: Record<string, any> = {
          deepseek: { id: 'deepseek', name: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', defaultModel: 'deepseek-chat' },
          qwen: { id: 'qwen', name: '通义千问', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', defaultModel: 'qwen-plus' },
          moonshot: { id: 'moonshot', name: 'Moonshot', baseUrl: 'https://api.moonshot.cn/v1', defaultModel: 'moonshot-v1-8k' },
          openai: { id: 'openai', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-4o-mini' },
        };
        return providers[id] || null;
      },
    }));
    vi.doMock('../../server/ai/writingSkills.js', () => ({
      listSkills: () => {
        const ids = ['continue', 'rewrite', 'polish', 'deai', 'style', 'dialogue', 'consistency', 'consistency-scan', 'inspiration', 'qa', 'plot-planning', 'chapter-summary', 'writing-advice', 'character-design', 'chapter-generate'];
        return ids.map((id, i) => ({ id, name: `Skill ${i}`, description: `Desc ${i}`, icon: 'p', systemPrompt: 'sp', needsSelection: false, temperature: 0.8, maxTokens: 4096 }));
      },
      getSkill: (id: string) => {
        const skills: Record<string, any> = {
          continue: { id: 'continue', name: '续写', needsSelection: false, temperature: 0.85, maxTokens: 2048 },
          deai: { id: 'deai', name: '去AI味', needsSelection: true, temperature: 0.7, maxTokens: 4096 },
          'consistency-scan': { id: 'consistency-scan', name: '一致性扫描', needsSelection: false, temperature: 0.3, maxTokens: 2048 },
          'chapter-generate': { id: 'chapter-generate', name: '章节生成', needsSelection: false, temperature: 0.8, maxTokens: 4096 },
        };
        return skills[id] || undefined;
      },
      WRITING_SKILLS: {},
    }));
    vi.doMock('../../server/middleware/sse.js', () => ({
      setupSSE: (_req: any, res: any) => {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        });
      },
      sendSSE: (res: any, event: string, data: any) => {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      },
      sendSSEError: (res: any, message: string) => {
        res.write(`event: error\ndata: ${JSON.stringify({ error: message })}\n\n`);
      },
      sendSSEDone: (res: any, content: string) => {
        res.write(`event: done\ndata: ${JSON.stringify({ content })}\n\n`);
        res.end();
      },
    }));
    const mod = await import('../../server/app.js');
    app = mod.default;
  });

  afterEach(() => {
    vi.doUnmock('../../server/services/aiService.js');
    vi.doUnmock('../../server/ai/agentFactory.js');
    vi.doUnmock('../../server/ai/configStore.js');
    vi.doUnmock('../../server/ai/providers.js');
    vi.doUnmock('../../server/ai/writingSkills.js');
    vi.doUnmock('../../server/middleware/sse.js');
    teardownMocks();
  });

  it('should list 17 skills', async () => {
    const res = await request(app).get('/api/ai/skills');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(17);
    const ids = res.body.data.map((s: any) => s.id);
    expect(ids).toContain('continue');
    expect(ids).toContain('deai');
    expect(ids).toContain('consistency-scan');
    expect(ids).toContain('chapter-generate');
    expect(ids).toContain('character-dialogue');
  });

  it('should list providers', async () => {
    const res = await request(app).get('/api/ai/providers');

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(4);
    const ids = res.body.data.map((p: any) => p.id);
    expect(ids).toContain('deepseek');
    expect(ids).toContain('qwen');
    expect(ids).toContain('moonshot');
    expect(ids).toContain('openai');
  });

  it('should return AI status with new fields', async () => {
    const res = await request(app).get('/api/ai/status');

    expect(res.status).toBe(200);
    expect(res.body.data.configured).toBe(false);
    expect(res.body.data.model).toBeDefined();
    expect(res.body.data.provider).toBeDefined();
    expect(res.body.data.baseUrl).toBeDefined();
    expect(res.body.data.temperature).toBeDefined();
    expect(res.body.data.maxTokens).toBeDefined();
  });

  it('should update config via PATCH', async () => {
    const res = await request(app).patch('/api/ai/config').send({
      provider: 'deepseek',
      temperature: 0.5,
      maxTokens: 2048,
    });

    expect(res.status).toBe(200);
    expect(res.body.data.provider).toBe('deepseek');
    expect(res.body.data.temperature).toBe(0.5);
    expect(res.body.data.maxTokens).toBe(2048);
  });

  it('should test connection and fail without key', async () => {
    const res = await request(app).post('/api/ai/test');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('API Key');
  });

  it('should reject stream without required fields', async () => {
    const res = await request(app).post('/api/ai/stream').send({});

    expect(res.status).toBe(400);
  });
});

describe('Stats API', () => {
  let projectId: string;

  beforeEach(async () => {
    testDb = createTestDb();
    setupMocks();
    const mod = await import('../../server/app.js');
    app = mod.default;

    const res = await request(app).post('/api/projects').send({ name: 'Stats Tests' });
    projectId = res.body.data.id;
  });

  afterEach(() => {
    teardownMocks();
  });

  it('should return empty stats', async () => {
    const res = await request(app).get(`/api/projects/${projectId}/stats`);

    expect(res.status).toBe(200);
    expect(res.body.data.summary.totalWords).toBe(0);
    expect(res.body.data.recent).toEqual([]);
  });

  it('should record a stat entry', async () => {
    const res = await request(app).post(`/api/projects/${projectId}/stats`)
      .send({ date: '2025-01-15', wordsAdded: 500, wordsTotal: 500 });

    expect(res.status).toBe(200);
    expect(res.body.data.words_added).toBe(500);
  });

  it('should accumulate on same date', async () => {
    await request(app).post(`/api/projects/${projectId}/stats`)
      .send({ date: '2025-01-15', wordsAdded: 500, wordsTotal: 500 });

    await request(app).post(`/api/projects/${projectId}/stats`)
      .send({ date: '2025-01-16', wordsAdded: 300, wordsTotal: 800 });

    await request(app).post(`/api/projects/${projectId}/stats`)
      .send({ date: '2025-01-16', wordsAdded: 200, wordsTotal: 1000 });

    const res = await request(app).get(`/api/projects/${projectId}/stats`);
    expect(res.body.data.summary.totalWords).toBe(1000);
    expect(res.body.data.summary.totalDays).toBe(2);
  });
});

describe('Export API', () => {
  beforeEach(async () => {
    testDb = createTestDb();
    setupMocks();
    const mod = await import('../../server/app.js');
    app = mod.default;
  });

  afterEach(() => {
    teardownMocks();
  });

  it('should export empty project as TXT', async () => {
    const res = await request(app).post('/api/projects').send({ name: 'Export Test' });
    const pid = res.body.data.id;

    const txt = await request(app).get(`/api/projects/${pid}/export/txt`);
    expect(txt.status).toBe(404); // No chapters
  });

  it('should export chapters as MD', async () => {
    const res = await request(app).post('/api/projects').send({ name: 'Export MD' });
    const pid = res.body.data.id;

    await request(app).post(`/api/projects/${pid}/chapters`).send({ title: 'Ch1' });
    const chs = await request(app).get(`/api/projects/${pid}/chapters`);
    const chId = chs.body.data[0].id;

    await request(app).put(`/api/projects/${pid}/chapters/${chId}/content`)
      .send({ content: 'Some content here.' });

    const md = await request(app).get(`/api/projects/${pid}/export/md`);
    expect(md.status).toBe(200);
    expect(md.text).toContain('## Ch1');
    expect(md.text).toContain('Some content here.');
  });
});
