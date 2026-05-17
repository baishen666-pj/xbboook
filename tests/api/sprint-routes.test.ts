import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import express from 'express';
import request from 'supertest';

let memDb: Database.Database;

vi.mock('../../server/db/database.js', () => ({
  getDb: () => memDb,
  initDb: vi.fn(),
}));

vi.mock('../../server/middleware/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  requestIdMiddleware: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
  requestLogger: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

import writingSprintRouter from '../../server/routes/writingSprint.js';

function setupTables(): void {
  memDb.exec(`
    CREATE TABLE projects (id TEXT PRIMARY KEY, name TEXT NOT NULL, status TEXT DEFAULT 'active', sort_order INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE writing_sprints (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, user_id TEXT DEFAULT 'default',
      type TEXT NOT NULL DEFAULT 'pomodoro', duration_minutes INTEGER NOT NULL DEFAULT 25,
      target_words INTEGER DEFAULT 0, actual_words INTEGER DEFAULT 0,
      status TEXT DEFAULT 'planned', started_at TEXT, ended_at TEXT, notes TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
    CREATE TABLE sprint_stats (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, user_id TEXT DEFAULT 'default',
      date TEXT NOT NULL, total_sprints INTEGER DEFAULT 0, total_minutes INTEGER DEFAULT 0,
      total_words INTEGER DEFAULT 0, best_wpm REAL DEFAULT 0, created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      UNIQUE(project_id, user_id, date)
    );
  `);
}

function seedProject(): string {
  const id = randomUUID();
  memDb.prepare("INSERT INTO projects (id, name) VALUES (?, 'Test')").run(id);
  return id;
}

describe('writing sprint routes', () => {
  let app: express.Express;
  let projectId: string;

  beforeEach(() => {
    memDb = new Database(':memory:');
    setupTables();
    projectId = seedProject();
    app = express();
    app.use(express.json());
    app.use('/api/projects/:projectId/sprints', writingSprintRouter);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (memDb) memDb.close();
  });

  describe('POST /', () => {
    it('creates a sprint', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/sprints`)
        .send({ type: 'pomodoro', durationMinutes: 25, targetWords: 500 });
      expect(res.status).toBe(201);
      expect(res.body.data.type).toBe('pomodoro');
      expect(res.body.data.status).toBe('planned');
    });

    it('validates input', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/sprints`)
        .send({ durationMinutes: 9999 });
      expect(res.status).toBe(400);
    });
  });

  describe('sprint lifecycle', () => {
    it('starts, pauses, resumes, and completes a sprint', async () => {
      const createRes = await request(app)
        .post(`/api/projects/${projectId}/sprints`)
        .send({ type: 'pomodoro', durationMinutes: 25 });
      const sprintId = createRes.body.data.id;

      const startRes = await request(app).post(`/api/projects/${projectId}/sprints/${sprintId}/start`);
      expect(startRes.body.data.status).toBe('active');

      const pauseRes = await request(app).post(`/api/projects/${projectId}/sprints/${sprintId}/pause`);
      expect(pauseRes.body.data.status).toBe('paused');

      const resumeRes = await request(app).post(`/api/projects/${projectId}/sprints/${sprintId}/resume`);
      expect(resumeRes.body.data.status).toBe('active');

      const completeRes = await request(app)
        .post(`/api/projects/${projectId}/sprints/${sprintId}/complete`)
        .send({ actualWords: 350 });
      expect(completeRes.body.data.status).toBe('completed');
      expect(completeRes.body.data.actualWords).toBe(350);
    });

    it('abandons a sprint', async () => {
      const createRes = await request(app)
        .post(`/api/projects/${projectId}/sprints`)
        .send({ type: 'sprint', durationMinutes: 15 });
      const sprintId = createRes.body.data.id;

      await request(app).post(`/api/projects/${projectId}/sprints/${sprintId}/start`);
      const res = await request(app).post(`/api/projects/${projectId}/sprints/${sprintId}/abandon`);
      expect(res.body.data.status).toBe('abandoned');
    });
  });

  describe('GET /', () => {
    it('lists sprints', async () => {
      await request(app).post(`/api/projects/${projectId}/sprints`).send({ type: 'pomodoro', durationMinutes: 25 });
      const res = await request(app).get(`/api/projects/${projectId}/sprints`);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });
  });

  describe('GET /stats', () => {
    it('returns stats', async () => {
      const res = await request(app).get(`/api/projects/${projectId}/sprints/stats?days=7`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('DELETE /:sprintId', () => {
    it('deletes a sprint', async () => {
      const createRes = await request(app)
        .post(`/api/projects/${projectId}/sprints`)
        .send({ type: 'pomodoro', durationMinutes: 25 });
      const res = await request(app).delete(`/api/projects/${projectId}/sprints/${createRes.body.data.id}`);
      expect(res.status).toBe(200);
    });
  });
});
