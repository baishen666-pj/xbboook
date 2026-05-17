import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { setupTestServer } from '../helpers/testServer.js';

const getApp = setupTestServer();

async function createProject() {
  const app = await getApp();
  const res = await request(app).post('/api/projects').send({ name: 'Test Project' });
  return res.body.data.id;
}

describe('Materials API', () => {
  let projectId: string;

  beforeEach(async () => {
    projectId = await createProject();
  });

  it('GET /materials should return empty list', async () => {
    const app = await getApp();
    const res = await request(app).get(`/api/projects/${projectId}/materials`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual([]);
  });

  it('POST /materials should create a material', async () => {
    const app = await getApp();
    const res = await request(app)
      .post(`/api/projects/${projectId}/materials`)
      .send({ title: 'Test', content: 'Content', category: 'plot', tags: ['tag1'] });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.title).toBe('Test');
    expect(res.body.data.category).toBe('plot');
  });

  it('POST /materials should require title and content', async () => {
    const app = await getApp();
    const res = await request(app)
      .post(`/api/projects/${projectId}/materials`)
      .send({ category: 'plot' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('GET /materials?category= should filter', async () => {
    const app = await getApp();
    await request(app).post(`/api/projects/${projectId}/materials`).send({ title: 'A', content: 'C', category: 'character' });
    await request(app).post(`/api/projects/${projectId}/materials`).send({ title: 'B', content: 'C', category: 'plot' });

    const res = await request(app).get(`/api/projects/${projectId}/materials?category=character`);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].category).toBe('character');
  });

  it('GET /materials?q= should search', async () => {
    const app = await getApp();
    await request(app).post(`/api/projects/${projectId}/materials`).send({ title: 'Hero Background', content: 'Brave warrior', category: 'character' });
    await request(app).post(`/api/projects/${projectId}/materials`).send({ title: 'Dark Plot', content: 'Evil scheme', category: 'plot' });

    const res = await request(app).get(`/api/projects/${projectId}/materials?q=Hero`);
    expect(res.body.data).toHaveLength(1);
  });

  it('PUT /materials/:id should update', async () => {
    const app = await getApp();
    const createRes = await request(app)
      .post(`/api/projects/${projectId}/materials`)
      .send({ title: 'Old', content: 'Content', category: 'other' });

    const id = createRes.body.data.id;
    const res = await request(app)
      .put(`/api/projects/${projectId}/materials/${id}`)
      .send({ title: 'New', category: 'plot' });

    expect(res.body.success).toBe(true);
    expect(res.body.data.title).toBe('New');
  });

  it('DELETE /materials/:id should delete', async () => {
    const app = await getApp();
    const createRes = await request(app)
      .post(`/api/projects/${projectId}/materials`)
      .send({ title: 'Delete Me', content: 'Bye', category: 'other' });

    const id = createRes.body.data.id;
    const res = await request(app).delete(`/api/projects/${projectId}/materials/${id}`);
    expect(res.body.success).toBe(true);

    const listRes = await request(app).get(`/api/projects/${projectId}/materials`);
    expect(listRes.body.data).toHaveLength(0);
  });

  it('GET /materials/stats should return category stats', async () => {
    const app = await getApp();
    await request(app).post(`/api/projects/${projectId}/materials`).send({ title: 'A', content: 'C', category: 'character' });
    await request(app).post(`/api/projects/${projectId}/materials`).send({ title: 'B', content: 'C', category: 'character' });
    await request(app).post(`/api/projects/${projectId}/materials`).send({ title: 'C', content: 'C', category: 'plot' });

    const res = await request(app).get(`/api/projects/${projectId}/materials/stats`);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(2);
  });
});
