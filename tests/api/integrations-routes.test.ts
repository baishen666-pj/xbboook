import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { setupTestServer } from '../helpers/testServer.js';

const getApp = setupTestServer();

async function createProject() {
  const app = await getApp();
  const res = await request(app).post('/api/projects').send({ name: 'Test Project' });
  return res.body.data.id;
}

describe('Integrations API', () => {
  let projectId: string;

  beforeEach(async () => {
    projectId = await createProject();
  });

  // ─── Webhooks ──────────────────────────────────────────────

  describe('Webhooks', () => {
    it('GET /webhooks should return empty list', async () => {
      const app = await getApp();
      const res = await request(app).get('/api/webhooks');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual([]);
    });

    it('GET /webhooks/events should return supported events', async () => {
      const app = await getApp();
      const res = await request(app).get('/api/webhooks/events');
      expect(res.status).toBe(200);
      expect(res.body.data).toContain('chapter:update');
    });

    it('POST /webhooks should create a webhook', async () => {
      const app = await getApp();
      const res = await request(app)
        .post('/api/webhooks')
        .send({ name: 'Test Hook', url: 'https://example.com/hook', events: ['chapter:update'], projectId });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Test Hook');
      expect(res.body.data.events).toContain('chapter:update');
      expect(res.body.data.secret).toBeDefined();
    });

    it('POST /webhooks should require name, url, events', async () => {
      const app = await getApp();
      const res = await request(app).post('/api/webhooks').send({});
      expect(res.status).toBe(400);
    });

    it('DELETE /webhooks/:id should delete', async () => {
      const app = await getApp();
      const createRes = await request(app)
        .post('/api/webhooks')
        .send({ name: 'Delete Me', url: 'https://example.com/hook', events: ['chapter:create'] });

      const id = createRes.body.data.id;
      const res = await request(app).delete(`/api/webhooks/${id}`);
      expect(res.body.success).toBe(true);

      const listRes = await request(app).get('/api/webhooks');
      expect(listRes.body.data).toHaveLength(0);
    });
  });

  // ─── Automation Rules ──────────────────────────────────────

  describe('Automation Rules', () => {
    it('GET /automations/types should return trigger and action types', async () => {
      const app = await getApp();
      const res = await request(app).get(`/api/projects/${projectId}/automations/types`);
      expect(res.status).toBe(200);
      expect(res.body.data.triggers).toContain('chapter:update');
      expect(res.body.data.actions).toContain('webhook:send');
    });

    it('POST /automations should create a rule', async () => {
      const app = await getApp();
      const res = await request(app)
        .post(`/api/projects/${projectId}/automations`)
        .send({ name: 'Auto Webhook', trigger: { type: 'chapter:update' }, action: { type: 'notify:log', config: {} } });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Auto Webhook');
      expect(res.body.data.trigger.type).toBe('chapter:update');
    });

    it('POST /automations should require name, trigger.type, action.type', async () => {
      const app = await getApp();
      const res = await request(app)
        .post(`/api/projects/${projectId}/automations`)
        .send({ name: 'Bad' });
      expect(res.status).toBe(400);
    });

    it('DELETE /automations/:ruleId should delete', async () => {
      const app = await getApp();
      const createRes = await request(app)
        .post(`/api/projects/${projectId}/automations`)
        .send({ name: 'Delete Rule', trigger: { type: 'checkin:after' }, action: { type: 'notify:log', config: {} } });

      const ruleId = createRes.body.data.id;
      const res = await request(app).delete(`/api/projects/${projectId}/automations/${ruleId}`);
      expect(res.body.success).toBe(true);

      const listRes = await request(app).get(`/api/projects/${projectId}/automations`);
      expect(listRes.body.data).toHaveLength(0);
    });
  });

  // ─── Notion Sync Config ────────────────────────────────────

  describe('Notion Sync', () => {
    it('GET /notion should return null when not configured', async () => {
      const app = await getApp();
      const res = await request(app).get(`/api/projects/${projectId}/notion`);
      expect(res.status).toBe(200);
      expect(res.body.data).toBeNull();
    });

    it('POST /notion should require notionToken and databaseId', async () => {
      const app = await getApp();
      const res = await request(app)
        .post(`/api/projects/${projectId}/notion`)
        .send({ syncMode: 'all' });
      expect(res.status).toBe(400);
    });

    it('POST /notion should save config', async () => {
      const app = await getApp();
      const res = await request(app)
        .post(`/api/projects/${projectId}/notion`)
        .send({ notionToken: 'test-token', databaseId: 'db-123', syncMode: 'chapters' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.databaseId).toBe('db-123');
    });

    it('DELETE /notion should remove config', async () => {
      const app = await getApp();
      await request(app)
        .post(`/api/projects/${projectId}/notion`)
        .send({ notionToken: 'test-token', databaseId: 'db-123' });

      const res = await request(app).delete(`/api/projects/${projectId}/notion`);
      expect(res.body.success).toBe(true);

      const getRes = await request(app).get(`/api/projects/${projectId}/notion`);
      expect(getRes.body.data).toBeNull();
    });
  });

  // ─── Feishu Sync Config ────────────────────────────────────

  describe('Feishu Sync', () => {
    it('GET /feishu should return null when not configured', async () => {
      const app = await getApp();
      const res = await request(app).get(`/api/projects/${projectId}/feishu`);
      expect(res.status).toBe(200);
      expect(res.body.data).toBeNull();
    });

    it('POST /feishu should require appId, appSecret, docToken', async () => {
      const app = await getApp();
      const res = await request(app)
        .post(`/api/projects/${projectId}/feishu`)
        .send({ syncMode: 'all' });
      expect(res.status).toBe(400);
    });

    it('POST /feishu should save config', async () => {
      const app = await getApp();
      const res = await request(app)
        .post(`/api/projects/${projectId}/feishu`)
        .send({ appId: 'cli_test', appSecret: 'secret123', docToken: 'doc-token', syncMode: 'all' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.appId).toBe('cli_test');
    });
  });
});
