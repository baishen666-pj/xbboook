import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { setupTestServer } from '../helpers/testServer.js';

const getApp = setupTestServer();

async function createProject(overrides: Record<string, unknown> = {}) {
  const app = await getApp();
  const defaults = { name: 'Test Project' };
  const res = await request(app).post('/api/projects').send({ ...defaults, ...overrides });
  return res;
}

async function insertChapter(
  projectId: string,
  overrides: Record<string, unknown> = {},
) {
  const { getDb } = await import('../../server/db/database.js');
  const db = getDb();
  const id = `ch-${Math.random().toString(36).slice(2, 10)}`;
  const now = new Date().toISOString();
  const defaults: Record<string, unknown> = {
    title: 'Test Chapter',
    file_path: `/projects/${projectId}/chapters/${id}.md`,
    word_count: 0,
    status: 'draft',
    sort_order: 0,
  };
  const data = { ...defaults, ...overrides };
  db.prepare(
    `INSERT INTO chapters (id, project_id, volume_id, title, summary, word_count, file_path, status, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id, projectId, data.volume_id ?? null, data.title, data.summary ?? null,
    data.word_count, data.file_path, data.status, data.sort_order, now, now,
  );
  return id;
}

describe('Projects API Routes', () => {
  let app: any;

  beforeEach(async () => {
    app = await getApp();
  });

  describe('POST /api/projects', () => {
    it('creates a project with only required name field', async () => {
      const res = await request(app).post('/api/projects').send({ name: 'Minimal Project' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Minimal Project');
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.word_count).toBe(0);
      expect(res.body.data.chapter_count).toBe(0);
    });

    it('creates a project with all optional fields', async () => {
      const res = await request(app)
        .post('/api/projects')
        .send({
          name: 'Full Project',
          description: 'An epic tale',
          genre: 'fantasy',
          writing_style: 'literary',
          writing_mode: 'serialized',
          target_words: 500000,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Full Project');
      expect(res.body.data.description).toBe('An epic tale');
      expect(res.body.data.genre).toBe('fantasy');
      expect(res.body.data.writing_style).toBe('literary');
      expect(res.body.data.writing_mode).toBe('serialized');
      expect(res.body.data.target_words).toBe(500000);
    });

    it('rejects creation with empty name', async () => {
      const res = await request(app).post('/api/projects').send({ name: '' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBeDefined();
    });

    it('rejects creation with missing name', async () => {
      const res = await request(app).post('/api/projects').send({ description: 'no name' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('defaults writing_mode to webnovel when omitted', async () => {
      const res = await request(app)
        .post('/api/projects')
        .send({ name: 'Default Mode' });

      expect(res.status).toBe(201);
      expect(res.body.data.writing_mode).toBe('webnovel');
    });

    it('sets default status to active', async () => {
      const res = await request(app)
        .post('/api/projects')
        .send({ name: 'Status Check' });

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe('active');
    });

    it('assigns an auto-incremented sort_order', async () => {
      const first = await request(app).post('/api/projects').send({ name: 'First' });
      const second = await request(app).post('/api/projects').send({ name: 'Second' });

      expect(first.body.data.sort_order).toBeDefined();
      expect(second.body.data.sort_order).toBeGreaterThan(first.body.data.sort_order);
    });

    it('returns enriched data with word_count and chapter_count', async () => {
      const res = await request(app).post('/api/projects').send({ name: 'Enriched' });

      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty('word_count');
      expect(res.body.data).toHaveProperty('chapter_count');
      expect(typeof res.body.data.word_count).toBe('number');
      expect(typeof res.body.data.chapter_count).toBe('number');
    });
  });

  describe('GET /api/projects', () => {
    it('returns empty array when no projects exist', async () => {
      const res = await request(app).get('/api/projects');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual([]);
    });

    it('returns all created projects', async () => {
      await createProject({ name: 'Novel A' });
      await createProject({ name: 'Novel B' });
      await createProject({ name: 'Novel C' });

      const res = await request(app).get('/api/projects');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(3);
    });

    it('enriches each project with word_count and chapter_count', async () => {
      const created = await createProject({ name: 'Enriched List' });
      const projectId = created.body.data.id;

      await insertChapter(projectId, { word_count: 1000 });
      await insertChapter(projectId, { word_count: 2500 });

      const res = await request(app).get('/api/projects');

      const found = res.body.data.find((p: { id: string }) => p.id === projectId);
      expect(found).toBeDefined();
      expect(found.word_count).toBe(3500);
      expect(found.chapter_count).toBe(2);
    });

    it('returns projects ordered by sort_order then created_at DESC', async () => {
      await createProject({ name: 'Z-First' });
      await createProject({ name: 'A-Second' });

      const res = await request(app).get('/api/projects');

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('GET /api/projects/:id', () => {
    it('returns a single project by id', async () => {
      const created = await createProject({ name: 'Get Me', genre: 'scifi' });
      const id = created.body.data.id;

      const res = await request(app).get(`/api/projects/${id}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(id);
      expect(res.body.data.name).toBe('Get Me');
      expect(res.body.data.genre).toBe('scifi');
    });

    it('returns enriched project with word_count and chapter_count', async () => {
      const created = await createProject({ name: 'Enriched Single' });
      const projectId = created.body.data.id;

      await insertChapter(projectId, { word_count: 500 });
      await insertChapter(projectId, { word_count: 750 });
      await insertChapter(projectId, { word_count: 1250 });

      const res = await request(app).get(`/api/projects/${projectId}`);

      expect(res.status).toBe(200);
      expect(res.body.data.word_count).toBe(2500);
      expect(res.body.data.chapter_count).toBe(3);
    });

    it('returns word_count 0 when project has no chapters', async () => {
      const created = await createProject({ name: 'No Chapters' });
      const id = created.body.data.id;

      const res = await request(app).get(`/api/projects/${id}`);

      expect(res.status).toBe(200);
      expect(res.body.data.word_count).toBe(0);
      expect(res.body.data.chapter_count).toBe(0);
    });

    it('returns 404 for non-existent project', async () => {
      const res = await request(app).get('/api/projects/nonexistent-id');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBeDefined();
    });
  });

  describe('PUT /api/projects/:id', () => {
    it('updates the name', async () => {
      const created = await createProject({ name: 'Before' });
      const id = created.body.data.id;

      const res = await request(app).put(`/api/projects/${id}`).send({ name: 'After' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('After');
    });

    it('updates description to a new value', async () => {
      const created = await createProject({ name: 'Desc Update' });
      const id = created.body.data.id;

      const res = await request(app)
        .put(`/api/projects/${id}`)
        .send({ description: 'New description' });

      expect(res.status).toBe(200);
      expect(res.body.data.description).toBe('New description');
    });

    it('updates description to null', async () => {
      const created = await createProject({ name: 'Desc Null', description: 'existing' });
      const id = created.body.data.id;

      const res = await request(app)
        .put(`/api/projects/${id}`)
        .send({ description: null });

      expect(res.status).toBe(200);
      expect(res.body.data.description).toBeNull();
    });

    it('updates genre to a new value', async () => {
      const created = await createProject({ name: 'Genre Update' });
      const id = created.body.data.id;

      const res = await request(app)
        .put(`/api/projects/${id}`)
        .send({ genre: 'horror' });

      expect(res.status).toBe(200);
      expect(res.body.data.genre).toBe('horror');
    });

    it('updates genre to null', async () => {
      const created = await createProject({ name: 'Genre Null', genre: 'fantasy' });
      const id = created.body.data.id;

      const res = await request(app)
        .put(`/api/projects/${id}`)
        .send({ genre: null });

      expect(res.status).toBe(200);
      expect(res.body.data.genre).toBeNull();
    });

    it('updates writing_style to null', async () => {
      const created = await createProject({ name: 'Style Null', writing_style: 'literary' });
      const id = created.body.data.id;

      const res = await request(app)
        .put(`/api/projects/${id}`)
        .send({ writing_style: null });

      expect(res.status).toBe(200);
      expect(res.body.data.writing_style).toBeNull();
    });

    it('updates target_words to null', async () => {
      const created = await createProject({ name: 'Target Null', target_words: 100000 });
      const id = created.body.data.id;

      const res = await request(app)
        .put(`/api/projects/${id}`)
        .send({ target_words: null });

      expect(res.status).toBe(200);
      expect(res.body.data.target_words).toBeNull();
    });

    it('updates target_words to a new number', async () => {
      const created = await createProject({ name: 'Target Num' });
      const id = created.body.data.id;

      const res = await request(app)
        .put(`/api/projects/${id}`)
        .send({ target_words: 250000 });

      expect(res.status).toBe(200);
      expect(res.body.data.target_words).toBe(250000);
    });

    it('updates status to archived', async () => {
      const created = await createProject({ name: 'Status Archive' });
      const id = created.body.data.id;

      const res = await request(app)
        .put(`/api/projects/${id}`)
        .send({ status: 'archived' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('archived');
    });

    it('updates status to completed', async () => {
      const created = await createProject({ name: 'Status Complete' });
      const id = created.body.data.id;

      const res = await request(app)
        .put(`/api/projects/${id}`)
        .send({ status: 'completed' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('completed');
    });

    it('updates sort_order', async () => {
      const created = await createProject({ name: 'Sort Order' });
      const id = created.body.data.id;

      const res = await request(app)
        .put(`/api/projects/${id}`)
        .send({ sort_order: 42 });

      expect(res.status).toBe(200);
      expect(res.body.data.sort_order).toBe(42);
    });

    it('updates multiple fields at once', async () => {
      const created = await createProject({ name: 'Multi Update' });
      const id = created.body.data.id;

      const res = await request(app)
        .put(`/api/projects/${id}`)
        .send({
          name: 'Multi Updated',
          description: 'Updated desc',
          genre: 'thriller',
          writing_style: 'minimalist',
          target_words: 300000,
          status: 'completed',
          sort_order: 10,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Multi Updated');
      expect(res.body.data.description).toBe('Updated desc');
      expect(res.body.data.genre).toBe('thriller');
      expect(res.body.data.writing_style).toBe('minimalist');
      expect(res.body.data.target_words).toBe(300000);
      expect(res.body.data.status).toBe('completed');
      expect(res.body.data.sort_order).toBe(10);
    });

    it('returns unchanged project when body is empty', async () => {
      const created = await createProject({ name: 'No Change' });
      const id = created.body.data.id;

      const res = await request(app).put(`/api/projects/${id}`).send({});

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('No Change');
    });

    it('returns 404 for non-existent project', async () => {
      const res = await request(app)
        .put('/api/projects/nonexistent-id')
        .send({ name: 'Ghost' });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBeDefined();
    });

    it('rejects invalid status value', async () => {
      const created = await createProject({ name: 'Bad Status' });
      const id = created.body.data.id;

      const res = await request(app)
        .put(`/api/projects/${id}`)
        .send({ status: 'invalid_status' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('rejects empty name in update', async () => {
      const created = await createProject({ name: 'Valid' });
      const id = created.body.data.id;

      const res = await request(app)
        .put(`/api/projects/${id}`)
        .send({ name: '' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('returns enriched data after update', async () => {
      const created = await createProject({ name: 'Enriched Update' });
      const projectId = created.body.data.id;

      await insertChapter(projectId, { word_count: 800 });

      const res = await request(app)
        .put(`/api/projects/${projectId}`)
        .send({ name: 'Enriched Updated' });

      expect(res.status).toBe(200);
      expect(res.body.data.word_count).toBe(800);
      expect(res.body.data.chapter_count).toBe(1);
    });
  });

  describe('DELETE /api/projects/:id', () => {
    it('deletes an existing project', async () => {
      const created = await createProject({ name: 'Delete Me' });
      const id = created.body.data.id;

      const res = await request(app).delete(`/api/projects/${id}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('project is no longer retrievable after deletion', async () => {
      const created = await createProject({ name: 'Gone Soon' });
      const id = created.body.data.id;

      await request(app).delete(`/api/projects/${id}`);

      const getRes = await request(app).get(`/api/projects/${id}`);
      expect(getRes.status).toBe(404);
    });

    it('project no longer appears in listing after deletion', async () => {
      const created = await createProject({ name: 'Vanish' });
      const id = created.body.data.id;

      await request(app).delete(`/api/projects/${id}`);

      const listRes = await request(app).get('/api/projects');
      const found = listRes.body.data.find((p: { id: string }) => p.id === id);
      expect(found).toBeUndefined();
    });

    it('returns 404 for non-existent project', async () => {
      const res = await request(app).delete('/api/projects/nonexistent-id');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBeDefined();
    });
  });

  describe('Enrichment (word_count and chapter_count)', () => {
    it('computes word_count as sum of all chapter word_counts', async () => {
      const created = await createProject({ name: 'Word Count Sum' });
      const projectId = created.body.data.id;

      await insertChapter(projectId, { word_count: 100 });
      await insertChapter(projectId, { word_count: 200 });
      await insertChapter(projectId, { word_count: 300 });

      const res = await request(app).get(`/api/projects/${projectId}`);

      expect(res.body.data.word_count).toBe(600);
      expect(res.body.data.chapter_count).toBe(3);
    });

    it('handles chapters with null or zero word_count', async () => {
      const created = await createProject({ name: 'Zero Words' });
      const projectId = created.body.data.id;

      await insertChapter(projectId, { word_count: 0 });
      await insertChapter(projectId, { word_count: 0 });

      const res = await request(app).get(`/api/projects/${projectId}`);

      expect(res.body.data.word_count).toBe(0);
      expect(res.body.data.chapter_count).toBe(2);
    });

    it('does not count chapters from other projects', async () => {
      const projA = await createProject({ name: 'Project A' });
      const projB = await createProject({ name: 'Project B' });
      const idA = projA.body.data.id;
      const idB = projB.body.data.id;

      await insertChapter(idA, { word_count: 500 });
      await insertChapter(idA, { word_count: 500 });
      await insertChapter(idB, { word_count: 9999 });

      const resA = await request(app).get(`/api/projects/${idA}`);
      const resB = await request(app).get(`/api/projects/${idB}`);

      expect(resA.body.data.word_count).toBe(1000);
      expect(resA.body.data.chapter_count).toBe(2);
      expect(resB.body.data.word_count).toBe(9999);
      expect(resB.body.data.chapter_count).toBe(1);
    });

    it('enrichment is accurate in listing endpoint', async () => {
      const projA = await createProject({ name: 'List A' });
      const projB = await createProject({ name: 'List B' });
      const idA = projA.body.data.id;
      const idB = projB.body.data.id;

      await insertChapter(idA, { word_count: 100 });
      await insertChapter(idB, { word_count: 200 });
      await insertChapter(idB, { word_count: 300 });

      const res = await request(app).get('/api/projects');

      const foundA = res.body.data.find((p: { id: string }) => p.id === idA);
      const foundB = res.body.data.find((p: { id: string }) => p.id === idB);

      expect(foundA.word_count).toBe(100);
      expect(foundA.chapter_count).toBe(1);
      expect(foundB.word_count).toBe(500);
      expect(foundB.chapter_count).toBe(2);
    });
  });
});
