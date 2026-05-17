import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import supertest from 'supertest';
import Database from 'better-sqlite3';
import express from 'express';
import { SCHEMA_SQL } from '../../server/db/schemaDefinitions.js';

function createTestDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.exec(SCHEMA_SQL);
  db.exec(`
    CREATE TABLE IF NOT EXISTS batch_jobs (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      plan_json TEXT NOT NULL DEFAULT '{}',
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending','running','paused','completed','failed','cancelled')),
      progress_json TEXT DEFAULT '{}',
      current_chapter_index INTEGER DEFAULT 0,
      error TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    )
  `);
  return db;
}

async function createTestApp(db: Database.Database) {
  vi.doMock('../../server/db/database.js', () => ({
    getDb: () => db,
  }));

  vi.doMock('../../server/ai/agentFactory.js', () => ({
    completeChat: vi.fn().mockResolvedValue('Generated chapter content that is long enough to pass the minimum length check.'),
    streamChat: vi.fn(),
    isConfigured: vi.fn().mockReturnValue(true),
  }));

  vi.doMock('../../server/ai/contextBuilder.js', () => ({
    buildContext: vi.fn().mockResolvedValue([]),
    contextToString: vi.fn().mockReturnValue(''),
  }));

  vi.doMock('../../server/services/fileService.js', () => ({
    readChapter: vi.fn().mockResolvedValue(''),
    writeChapter: vi.fn().mockResolvedValue(undefined),
    deleteChapter: vi.fn().mockResolvedValue(undefined),
  }));

  const { default: batchRouter } = await import('../../server/routes/batchGeneration.js');
  const app = express();
  app.use(express.json());
  app.use('/api/projects/:projectId/batch-generation', batchRouter);
  return app;
}

describe('Batch Generation Routes', () => {
  let db: Database.Database;
  let projectId: string;

  beforeEach(() => {
    db = createTestDb();
    const id = 'test-project-00000000-0000-0000-0000-000000000001';
    db.prepare(`
      INSERT INTO projects (id, name, status, sort_order, created_at, updated_at)
      VALUES (?, 'Test Project', 'active', 0, datetime('now'), datetime('now'))
    `).run(id);
    projectId = id;
  });

  afterEach(() => {
    db.close();
    vi.doUnmock('../../server/db/database.js');
    vi.doUnmock('../../server/ai/agentFactory.js');
    vi.doUnmock('../../server/ai/contextBuilder.js');
    vi.doUnmock('../../server/services/fileService.js');
    vi.resetModules();
  });

  describe('POST /plan', () => {
    it('returns a batch plan', async () => {
      db.prepare(`
        INSERT INTO outlines (id, project_id, level, title, content, sort_order, created_at, updated_at)
        VALUES (?, ?, 1, 'Chapter 1', 'A beginning', 0, datetime('now'), datetime('now'))
      `).run('outline-1', projectId);

      const app = await createTestApp(db);
      const res = await supertest(app)
        .post(`/api/projects/${projectId}/batch-generation/plan`)
        .send({ temperature: 0.8 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.chapters).toBeInstanceOf(Array);
      expect(res.body.data.projectId).toBe(projectId);
      expect(res.body.data.temperature).toBe(0.8);
    });

    it('returns empty chapters when no outlines exist', async () => {
      const app = await createTestApp(db);
      const res = await supertest(app)
        .post(`/api/projects/${projectId}/batch-generation/plan`)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.chapters).toEqual([]);
    });
  });

  describe('POST /execute', () => {
    it('returns 400 when plan is missing', async () => {
      const app = await createTestApp(db);
      const res = await supertest(app)
        .post(`/api/projects/${projectId}/batch-generation/execute`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('plan.chapters');
    });
  });

  describe('POST /pause', () => {
    it('returns 400 when jobId is missing', async () => {
      const app = await createTestApp(db);
      const res = await supertest(app)
        .post(`/api/projects/${projectId}/batch-generation/pause`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('returns 404 when job not found', async () => {
      const app = await createTestApp(db);
      const res = await supertest(app)
        .post(`/api/projects/${projectId}/batch-generation/pause`)
        .send({ jobId: 'nonexistent' });

      expect(res.status).toBe(404);
    });
  });

  describe('GET /status', () => {
    it('returns null when no active jobs', async () => {
      const app = await createTestApp(db);
      const res = await supertest(app)
        .get(`/api/projects/${projectId}/batch-generation/status`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeNull();
    });

    it('returns active job', async () => {
      db.prepare(`
        INSERT INTO batch_jobs (id, project_id, plan_json, status, created_at, updated_at)
        VALUES (?, ?, '{}', 'running', datetime('now'), datetime('now'))
      `).run('job-1', projectId);

      const app = await createTestApp(db);
      const res = await supertest(app)
        .get(`/api/projects/${projectId}/batch-generation/status`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe('job-1');
      expect(res.body.data.status).toBe('running');
    });
  });

  describe('DELETE /:batchId', () => {
    it('returns 404 when job not found', async () => {
      const app = await createTestApp(db);
      const res = await supertest(app)
        .delete(`/api/projects/${projectId}/batch-generation/nonexistent`);

      expect(res.status).toBe(404);
    });

    it('cancels and deletes a running job', async () => {
      db.prepare(`
        INSERT INTO batch_jobs (id, project_id, plan_json, status, created_at, updated_at)
        VALUES (?, ?, '{}', 'pending', datetime('now'), datetime('now'))
      `).run('job-2', projectId);

      const app = await createTestApp(db);
      const res = await supertest(app)
        .delete(`/api/projects/${projectId}/batch-generation/job-2`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const check = await supertest(app)
        .get(`/api/projects/${projectId}/batch-generation/status`);
      expect(check.body.data).toBeNull();
    });
  });
});
