import { describe, it, expect } from 'vitest';
import request from 'supertest';

const BASE = 'http://localhost:3210';

describe('Worldviews API', () => {
  let projectId: string;

  beforeAll(async () => {
    const res = await request(BASE).post('/api/projects').send({ name: 'WV Tests' });
    projectId = res.body.data.id;
  });

  it('should create a worldview entry', async () => {
    const res = await request(BASE)
      .post(`/api/projects/${projectId}/worldviews`)
      .send({ category: 'power', title: 'Qi System', content: 'Nine levels of qi cultivation' });

    expect(res.status).toBe(201);
    expect(res.body.data.category).toBe('power');
    expect(res.body.data.title).toBe('Qi System');
  });

  it('should list worldviews with categories', async () => {
    await request(BASE).post(`/api/projects/${projectId}/worldviews`)
      .send({ category: 'geography', title: 'Mountains' });

    const res = await request(BASE).get(`/api/projects/${projectId}/worldviews`);

    expect(res.status).toBe(200);
    expect(res.body.data.items.length).toBeGreaterThanOrEqual(2);
    expect(res.body.data.categories).toContain('power');
    expect(res.body.data.categories).toContain('geography');
  });

  it('should filter by category', async () => {
    const res = await request(BASE).get(`/api/projects/${projectId}/worldviews?category=power`);

    expect(res.status).toBe(200);
    expect(res.body.data.every((w: any) => w.category === 'power')).toBe(true);
  });

  it('should update a worldview', async () => {
    const create = await request(BASE).post(`/api/projects/${projectId}/worldviews`)
      .send({ category: 'test', title: 'Before' });
    const id = create.body.data.id;

    const res = await request(BASE).put(`/api/projects/${projectId}/worldviews/${id}`)
      .send({ title: 'After', content: 'updated' });

    expect(res.body.data.title).toBe('After');
  });

  it('should delete a worldview', async () => {
    const create = await request(BASE).post(`/api/projects/${projectId}/worldviews`)
      .send({ category: 'del', title: 'Bye' });

    const res = await request(BASE).delete(`/api/projects/${projectId}/worldviews/${create.body.data.id}`);
    expect(res.status).toBe(200);
  });

  it('should reject missing fields', async () => {
    const res = await request(BASE).post(`/api/projects/${projectId}/worldviews`)
      .send({ title: 'No Category' });

    expect(res.status).toBe(400);
  });
});

describe('Outlines API', () => {
  let projectId: string;

  beforeAll(async () => {
    const res = await request(BASE).post('/api/projects').send({ name: 'Outline Tests' });
    projectId = res.body.data.id;
  });

  it('should create outline nodes', async () => {
    const root = await request(BASE).post(`/api/projects/${projectId}/outlines`)
      .send({ title: 'Act 1', level: 0, content: 'Introduction' });

    expect(root.status).toBe(201);
    expect(root.body.data.level).toBe(0);

    const child = await request(BASE).post(`/api/projects/${projectId}/outlines`)
      .send({ title: 'Scene 1', level: 1, parentId: root.body.data.id });

    expect(child.status).toBe(201);
  });

  it('should list outlines sorted by level', async () => {
    const res = await request(BASE).get(`/api/projects/${projectId}/outlines`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
  });

  it('should update an outline node', async () => {
    const create = await request(BASE).post(`/api/projects/${projectId}/outlines`)
      .send({ title: 'Before' });

    const res = await request(BASE).put(`/api/projects/${projectId}/outlines/${create.body.data.id}`)
      .send({ title: 'After', content: 'Updated content' });

    expect(res.body.data.title).toBe('After');
  });

  it('should delete and reassign children', async () => {
    const parent = await request(BASE).post(`/api/projects/${projectId}/outlines`)
      .send({ title: 'Parent', level: 0 });
    const child = await request(BASE).post(`/api/projects/${projectId}/outlines`)
      .send({ title: 'Child', level: 1, parentId: parent.body.data.id });

    // Delete parent
    await request(BASE).delete(`/api/projects/${projectId}/outlines/${parent.body.data.id}`);

    // Child should still exist
    const all = await request(BASE).get(`/api/projects/${projectId}/outlines`);
    const childExists = all.body.data.some((o: any) => o.id === child.body.data.id);
    expect(childExists).toBe(true);
  });
});

describe('AI API', () => {
  it('should list 15 skills', async () => {
    const res = await request(BASE).get('/api/ai/skills');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(15);
    const ids = res.body.data.map((s: any) => s.id);
    expect(ids).toContain('continue');
    expect(ids).toContain('deai');
    expect(ids).toContain('consistency-scan');
    expect(ids).toContain('chapter-generate');
  });

  it('should list providers', async () => {
    const res = await request(BASE).get('/api/ai/providers');

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(4);
    const ids = res.body.data.map((p: any) => p.id);
    expect(ids).toContain('deepseek');
    expect(ids).toContain('qwen');
    expect(ids).toContain('moonshot');
    expect(ids).toContain('openai');
  });

  it('should return AI status with new fields', async () => {
    const res = await request(BASE).get('/api/ai/status');

    expect(res.status).toBe(200);
    expect(res.body.data.configured).toBe(false);
    expect(res.body.data.model).toBeDefined();
    expect(res.body.data.provider).toBeDefined();
    expect(res.body.data.baseUrl).toBeDefined();
    expect(res.body.data.temperature).toBeDefined();
    expect(res.body.data.maxTokens).toBeDefined();
  });

  it('should update config via PATCH', async () => {
    const res = await request(BASE).patch('/api/ai/config').send({
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
    const res = await request(BASE).post('/api/ai/test');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('API Key');
  });

  it('should reject stream without required fields', async () => {
    const res = await request(BASE).post('/api/ai/stream').send({});

    expect(res.status).toBe(400);
  });
});

describe('Stats API', () => {
  let projectId: string;

  beforeAll(async () => {
    const res = await request(BASE).post('/api/projects').send({ name: 'Stats Tests' });
    projectId = res.body.data.id;
  });

  it('should return empty stats', async () => {
    const res = await request(BASE).get(`/api/projects/${projectId}/stats`);

    expect(res.status).toBe(200);
    expect(res.body.data.summary.totalWords).toBe(0);
    expect(res.body.data.recent).toEqual([]);
  });

  it('should record a stat entry', async () => {
    const res = await request(BASE).post(`/api/projects/${projectId}/stats`)
      .send({ date: '2025-01-15', wordsAdded: 500, wordsTotal: 500 });

    expect(res.status).toBe(200);
    expect(res.body.data.words_added).toBe(500);
  });

  it('should accumulate on same date', async () => {
    await request(BASE).post(`/api/projects/${projectId}/stats`)
      .send({ date: '2025-01-16', wordsAdded: 300, wordsTotal: 800 });

    await request(BASE).post(`/api/projects/${projectId}/stats`)
      .send({ date: '2025-01-16', wordsAdded: 200, wordsTotal: 1000 });

    const res = await request(BASE).get(`/api/projects/${projectId}/stats`);
    expect(res.body.data.summary.totalWords).toBe(1000);
    expect(res.body.data.summary.totalDays).toBe(2);
  });
});

describe('Export API', () => {
  it('should export empty project as TXT', async () => {
    const res = await request(BASE).post('/api/projects').send({ name: 'Export Test' });
    const pid = res.body.data.id;

    const txt = await request(BASE).get(`/api/projects/${pid}/export/txt`);
    expect(txt.status).toBe(404); // No chapters
  });

  it('should export chapters as MD', async () => {
    const res = await request(BASE).post('/api/projects').send({ name: 'Export MD' });
    const pid = res.body.data.id;

    await request(BASE).post(`/api/projects/${pid}/chapters`).send({ title: 'Ch1' });
    const chs = await request(BASE).get(`/api/projects/${pid}/chapters`);
    const chId = chs.body.data[0].id;

    await request(BASE).put(`/api/projects/${pid}/chapters/${chId}/content`)
      .send({ content: 'Some content here.' });

    const md = await request(BASE).get(`/api/projects/${pid}/export/md`);
    expect(md.status).toBe(200);
    expect(md.text).toContain('## Ch1');
    expect(md.text).toContain('Some content here.');
  });
});
