import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import supertest from 'supertest';
import express from 'express';
import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import { SCHEMA_SQL, POST_SCHEMA_ALTER_SQL } from '../../server/db/schemaDefinitions.js';

function createTestDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA_SQL);
  db.exec(POST_SCHEMA_ALTER_SQL);
  return db;
}

function seedProject(db: Database.Database): string {
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO projects (id, name, genre, writing_mode, sort_order, created_at, updated_at)
    VALUES (?, ?, 'fantasy', 'webnovel', 0, ?, ?)
  `).run(id, 'Test Novel', now, now);
  return id;
}

async function createTestApp(db: Database.Database) {
  vi.doMock('../../server/db/database.js', () => ({
    getDb: () => db,
  }));

  const { default: storyArcsRouter } = await import('../../server/routes/storyArcs.js');
  const app = express();
  app.use(express.json());
  app.use('/api/projects/:projectId/story', storyArcsRouter);
  return app;
}

describe('Story Arcs Routes', () => {
  let db: Database.Database;
  let projectId: string;

  beforeEach(() => {
    vi.resetModules();
    db = createTestDb();
    projectId = seedProject(db);
  });

  afterEach(() => {
    db.close();
    vi.doUnmock('../../server/db/database.js');
  });

  // --- Story Arcs ---

  describe('GET /api/projects/:projectId/story/arcs', () => {
    it('returns empty list when no arcs exist', async () => {
      const app = await createTestApp(db);
      const res = await supertest(app).get(`/api/projects/${projectId}/story/arcs`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual([]);
    });

    it('returns arcs for the project ordered by sort_order', async () => {
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO story_arcs (id, project_id, name, status, sort_order, created_at, updated_at)
        VALUES (?, ?, ?, 'planned', ?, ?, ?)
      `).run('arc-1', projectId, 'Second Arc', 1, now, now);
      db.prepare(`
        INSERT INTO story_arcs (id, project_id, name, status, sort_order, created_at, updated_at)
        VALUES (?, ?, ?, 'planned', ?, ?, ?)
      `).run('arc-2', projectId, 'First Arc', 0, now, now);

      const app = await createTestApp(db);
      const res = await supertest(app).get(`/api/projects/${projectId}/story/arcs`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0].name).toBe('First Arc');
      expect(res.body.data[1].name).toBe('Second Arc');
    });

    it('returns arcs only for the specified project', async () => {
      const otherProjectId = seedProject(db);
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO story_arcs (id, project_id, name, status, sort_order, created_at, updated_at)
        VALUES (?, ?, ?, 'planned', 0, ?, ?)
      `).run('arc-1', projectId, 'My Arc', now, now);
      db.prepare(`
        INSERT INTO story_arcs (id, project_id, name, status, sort_order, created_at, updated_at)
        VALUES (?, ?, ?, 'planned', 0, ?, ?)
      `).run('arc-2', otherProjectId, 'Other Arc', now, now);

      const app = await createTestApp(db);
      const res = await supertest(app).get(`/api/projects/${projectId}/story/arcs`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].name).toBe('My Arc');
    });
  });

  describe('POST /api/projects/:projectId/story/arcs', () => {
    it('creates an arc with name only', async () => {
      const app = await createTestApp(db);
      const res = await supertest(app)
        .post(`/api/projects/${projectId}/story/arcs`)
        .send({ name: 'Main Arc' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Main Arc');
      expect(res.body.data.status).toBe('planned');
      expect(res.body.data.project_id).toBe(projectId);
      expect(res.body.data.id).toBeTruthy();
    });

    it('creates an arc with all optional fields', async () => {
      const app = await createTestApp(db);
      const res = await supertest(app)
        .post(`/api/projects/${projectId}/story/arcs`)
        .send({
          name: 'Detailed Arc',
          description: 'A detailed story arc',
          startChapter: 1,
          endChapter: 10,
          status: 'active',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Detailed Arc');
      expect(res.body.data.description).toBe('A detailed story arc');
      expect(res.body.data.start_chapter).toBe(1);
      expect(res.body.data.end_chapter).toBe(10);
      expect(res.body.data.status).toBe('active');
    });

    it('assigns incrementing sort_order', async () => {
      const app = await createTestApp(db);
      await supertest(app)
        .post(`/api/projects/${projectId}/story/arcs`)
        .send({ name: 'Arc 1' });
      const res2 = await supertest(app)
        .post(`/api/projects/${projectId}/story/arcs`)
        .send({ name: 'Arc 2' });

      expect(res2.body.data.sort_order).toBe(1);
    });

    it('rejects empty name with 400', async () => {
      const app = await createTestApp(db);
      const res = await supertest(app)
        .post(`/api/projects/${projectId}/story/arcs`)
        .send({ name: '' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('rejects missing name with 400', async () => {
      const app = await createTestApp(db);
      const res = await supertest(app)
        .post(`/api/projects/${projectId}/story/arcs`)
        .send({ description: 'no name' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('rejects invalid status enum with 400', async () => {
      const app = await createTestApp(db);
      const res = await supertest(app)
        .post(`/api/projects/${projectId}/story/arcs`)
        .send({ name: 'Arc', status: 'invalid' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('PUT /api/projects/:projectId/story/arcs/:id', () => {
    it('updates an existing arc', async () => {
      const app = await createTestApp(db);
      const createRes = await supertest(app)
        .post(`/api/projects/${projectId}/story/arcs`)
        .send({ name: 'Original' });
      const arcId = createRes.body.data.id;

      const res = await supertest(app)
        .put(`/api/projects/${projectId}/story/arcs/${arcId}`)
        .send({ name: 'Updated', status: 'active' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Updated');
      expect(res.body.data.status).toBe('active');
    });

    it('updates description to null', async () => {
      const app = await createTestApp(db);
      const createRes = await supertest(app)
        .post(`/api/projects/${projectId}/story/arcs`)
        .send({ name: 'Arc', description: 'old desc' });
      const arcId = createRes.body.data.id;

      const res = await supertest(app)
        .put(`/api/projects/${projectId}/story/arcs/${arcId}`)
        .send({ description: null });

      expect(res.status).toBe(200);
      expect(res.body.data.description).toBeNull();
    });

    it('returns 404 for non-existent arc', async () => {
      const app = await createTestApp(db);
      const res = await supertest(app)
        .put(`/api/projects/${projectId}/story/arcs/nonexistent-id`)
        .send({ name: 'Update' });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('弧线不存在');
    });

    it('rejects invalid update schema with 400', async () => {
      const app = await createTestApp(db);
      const createRes = await supertest(app)
        .post(`/api/projects/${projectId}/story/arcs`)
        .send({ name: 'Arc' });
      const arcId = createRes.body.data.id;

      const res = await supertest(app)
        .put(`/api/projects/${projectId}/story/arcs/${arcId}`)
        .send({ name: '' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('DELETE /api/projects/:projectId/story/arcs/:id', () => {
    it('deletes an existing arc', async () => {
      const app = await createTestApp(db);
      const createRes = await supertest(app)
        .post(`/api/projects/${projectId}/story/arcs`)
        .send({ name: 'To Delete' });
      const arcId = createRes.body.data.id;

      const res = await supertest(app)
        .delete(`/api/projects/${projectId}/story/arcs/${arcId}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify it is gone
      const listRes = await supertest(app).get(`/api/projects/${projectId}/story/arcs`);
      expect(listRes.body.data).toHaveLength(0);
    });

    it('returns 404 for non-existent arc', async () => {
      const app = await createTestApp(db);
      const res = await supertest(app)
        .delete(`/api/projects/${projectId}/story/arcs/nonexistent-id`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('弧线不存在');
    });
  });

  describe('PUT /api/projects/:projectId/story/arcs/reorder', () => {
    it('reorders arcs by updating sort_order', async () => {
      const app = await createTestApp(db);
      const res1 = await supertest(app)
        .post(`/api/projects/${projectId}/story/arcs`)
        .send({ name: 'Arc A' });
      const res2 = await supertest(app)
        .post(`/api/projects/${projectId}/story/arcs`)
        .send({ name: 'Arc B' });
      const id1 = res1.body.data.id;
      const id2 = res2.body.data.id;

      // Swap order: A was 0, B was 1; now A is 1, B is 0
      const res = await supertest(app)
        .put(`/api/projects/${projectId}/story/arcs/reorder`)
        .send({ items: [{ id: id1, sortOrder: 1 }, { id: id2, sortOrder: 0 }] });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const listRes = await supertest(app).get(`/api/projects/${projectId}/story/arcs`);
      expect(listRes.body.data[0].name).toBe('Arc B');
      expect(listRes.body.data[0].sort_order).toBe(0);
      expect(listRes.body.data[1].name).toBe('Arc A');
      expect(listRes.body.data[1].sort_order).toBe(1);
    });

    it('rejects empty items array with 400', async () => {
      const app = await createTestApp(db);
      const res = await supertest(app)
        .put(`/api/projects/${projectId}/story/arcs/reorder`)
        .send({ items: [] });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('rejects missing items field with 400', async () => {
      const app = await createTestApp(db);
      const res = await supertest(app)
        .put(`/api/projects/${projectId}/story/arcs/reorder`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('rejects items with missing id with 400', async () => {
      const app = await createTestApp(db);
      const res = await supertest(app)
        .put(`/api/projects/${projectId}/story/arcs/reorder`)
        .send({ items: [{ sortOrder: 0 }] });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('rejects items with missing sortOrder with 400', async () => {
      const app = await createTestApp(db);
      const res = await supertest(app)
        .put(`/api/projects/${projectId}/story/arcs/reorder`)
        .send({ items: [{ id: 'some-id' }] });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  // --- Plot Threads ---

  describe('GET /api/projects/:projectId/story/threads', () => {
    it('returns empty list when no threads exist', async () => {
      const app = await createTestApp(db);
      const res = await supertest(app).get(`/api/projects/${projectId}/story/threads`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual([]);
    });

    it('returns threads for the project ordered by sort_order', async () => {
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO plot_threads (id, project_id, name, status, priority, sort_order, created_at, updated_at)
        VALUES (?, ?, ?, 'open', 'normal', ?, ?, ?)
      `).run('t-1', projectId, 'Second Thread', 1, now, now);
      db.prepare(`
        INSERT INTO plot_threads (id, project_id, name, status, priority, sort_order, created_at, updated_at)
        VALUES (?, ?, ?, 'open', 'normal', ?, ?, ?)
      `).run('t-2', projectId, 'First Thread', 0, now, now);

      const app = await createTestApp(db);
      const res = await supertest(app).get(`/api/projects/${projectId}/story/threads`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0].name).toBe('First Thread');
      expect(res.body.data[1].name).toBe('Second Thread');
    });
  });

  describe('GET /api/projects/:projectId/story/arcs/:id/threads', () => {
    it('returns threads belonging to a specific arc', async () => {
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO story_arcs (id, project_id, name, status, sort_order, created_at, updated_at)
        VALUES (?, ?, ?, 'planned', 0, ?, ?)
      `).run('arc-1', projectId, 'Arc', now, now);
      db.prepare(`
        INSERT INTO plot_threads (id, project_id, arc_id, name, status, priority, sort_order, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'open', 'normal', 0, ?, ?)
      `).run('t-1', projectId, 'arc-1', 'In Arc', now, now);
      db.prepare(`
        INSERT INTO plot_threads (id, project_id, arc_id, name, status, priority, sort_order, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'open', 'normal', 1, ?, ?)
      `).run('t-2', projectId, null, 'No Arc', now, now);

      const app = await createTestApp(db);
      const res = await supertest(app).get(`/api/projects/${projectId}/story/arcs/arc-1/threads`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].name).toBe('In Arc');
    });
  });

  describe('POST /api/projects/:projectId/story/threads', () => {
    it('creates a thread with name only', async () => {
      const app = await createTestApp(db);
      const res = await supertest(app)
        .post(`/api/projects/${projectId}/story/threads`)
        .send({ name: 'Main Mystery' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Main Mystery');
      expect(res.body.data.status).toBe('open');
      expect(res.body.data.priority).toBe('normal');
      expect(res.body.data.project_id).toBe(projectId);
    });

    it('creates a thread linked to an arc', async () => {
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO story_arcs (id, project_id, name, status, sort_order, created_at, updated_at)
        VALUES (?, ?, ?, 'planned', 0, ?, ?)
      `).run('arc-1', projectId, 'Arc', now, now);

      const app = await createTestApp(db);
      const res = await supertest(app)
        .post(`/api/projects/${projectId}/story/threads`)
        .send({ name: 'Linked Thread', arcId: 'arc-1' });

      expect(res.status).toBe(201);
      expect(res.body.data.arc_id).toBe('arc-1');
    });

    it('creates a thread with all optional fields', async () => {
      const app = await createTestApp(db);
      const res = await supertest(app)
        .post(`/api/projects/${projectId}/story/threads`)
        .send({
          name: 'Full Thread',
          description: 'A complete thread',
          status: 'dormant',
          priority: 'critical',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.description).toBe('A complete thread');
      expect(res.body.data.status).toBe('dormant');
      expect(res.body.data.priority).toBe('critical');
    });

    it('rejects empty name with 400', async () => {
      const app = await createTestApp(db);
      const res = await supertest(app)
        .post(`/api/projects/${projectId}/story/threads`)
        .send({ name: '' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('rejects invalid status enum with 400', async () => {
      const app = await createTestApp(db);
      const res = await supertest(app)
        .post(`/api/projects/${projectId}/story/threads`)
        .send({ name: 'Thread', status: 'unknown' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('rejects invalid priority enum with 400', async () => {
      const app = await createTestApp(db);
      const res = await supertest(app)
        .post(`/api/projects/${projectId}/story/threads`)
        .send({ name: 'Thread', priority: 'urgent' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('PUT /api/projects/:projectId/story/threads/:threadId', () => {
    it('updates an existing thread', async () => {
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO plot_threads (id, project_id, name, status, priority, sort_order, created_at, updated_at)
        VALUES (?, ?, ?, 'open', 'normal', 0, ?, ?)
      `).run('t-1', projectId, 'Original Thread', now, now);

      const app = await createTestApp(db);
      const res = await supertest(app)
        .put(`/api/projects/${projectId}/story/threads/t-1`)
        .send({ name: 'Updated Thread', status: 'resolved' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Updated Thread');
      expect(res.body.data.status).toBe('resolved');
    });

    it('updates priority of a thread', async () => {
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO plot_threads (id, project_id, name, status, priority, sort_order, created_at, updated_at)
        VALUES (?, ?, ?, 'open', 'normal', 0, ?, ?)
      `).run('t-1', projectId, 'Thread', now, now);

      const app = await createTestApp(db);
      const res = await supertest(app)
        .put(`/api/projects/${projectId}/story/threads/t-1`)
        .send({ priority: 'high' });

      expect(res.status).toBe(200);
      expect(res.body.data.priority).toBe('high');
    });

    it('returns 404 for non-existent thread', async () => {
      const app = await createTestApp(db);
      const res = await supertest(app)
        .put(`/api/projects/${projectId}/story/threads/nonexistent`)
        .send({ name: 'Update' });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('线索不存在');
    });
  });

  describe('DELETE /api/projects/:projectId/story/threads/:threadId', () => {
    it('deletes an existing thread', async () => {
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO plot_threads (id, project_id, name, status, priority, sort_order, created_at, updated_at)
        VALUES (?, ?, ?, 'open', 'normal', 0, ?, ?)
      `).run('t-1', projectId, 'Thread', now, now);

      const app = await createTestApp(db);
      const res = await supertest(app)
        .delete(`/api/projects/${projectId}/story/threads/t-1`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const listRes = await supertest(app).get(`/api/projects/${projectId}/story/threads`);
      expect(listRes.body.data).toHaveLength(0);
    });

    it('returns 404 for non-existent thread', async () => {
      const app = await createTestApp(db);
      const res = await supertest(app)
        .delete(`/api/projects/${projectId}/story/threads/nonexistent`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('线索不存在');
    });
  });

  describe('PUT /api/projects/:projectId/story/threads/reorder', () => {
    it('reorders threads by updating sort_order', async () => {
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO plot_threads (id, project_id, name, status, priority, sort_order, created_at, updated_at)
        VALUES (?, ?, ?, 'open', 'normal', ?, ?, ?)
      `).run('t-1', projectId, 'Thread A', 0, now, now);
      db.prepare(`
        INSERT INTO plot_threads (id, project_id, name, status, priority, sort_order, created_at, updated_at)
        VALUES (?, ?, ?, 'open', 'normal', ?, ?, ?)
      `).run('t-2', projectId, 'Thread B', 1, now, now);

      const app = await createTestApp(db);
      const res = await supertest(app)
        .put(`/api/projects/${projectId}/story/threads/reorder`)
        .send({ items: [{ id: 't-1', sortOrder: 1 }, { id: 't-2', sortOrder: 0 }] });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const listRes = await supertest(app).get(`/api/projects/${projectId}/story/threads`);
      expect(listRes.body.data[0].name).toBe('Thread B');
      expect(listRes.body.data[0].sort_order).toBe(0);
      expect(listRes.body.data[1].name).toBe('Thread A');
      expect(listRes.body.data[1].sort_order).toBe(1);
    });

    it('rejects missing items field with 400', async () => {
      const app = await createTestApp(db);
      const res = await supertest(app)
        .put(`/api/projects/${projectId}/story/threads/reorder`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('rejects items with wrong shape with 400', async () => {
      const app = await createTestApp(db);
      const res = await supertest(app)
        .put(`/api/projects/${projectId}/story/threads/reorder`)
        .send({ items: [{ id: 123, sortOrder: 'first' }] });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });
});
