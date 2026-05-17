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

vi.mock('../../server/db/repositories/chapterRepo.js', () => ({
  chapterRepo: {
    findById: vi.fn().mockReturnValue(undefined),
    findByProject: vi.fn().mockReturnValue([]),
  },
}));

import { complianceRouter } from '../../server/routes/compliance.js';

function setupTables(): void {
  memDb.exec(`
    CREATE TABLE projects (id TEXT PRIMARY KEY, name TEXT NOT NULL, status TEXT DEFAULT 'active', sort_order INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE compliance_rules (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, name TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'sensitive', pattern TEXT NOT NULL,
      severity TEXT DEFAULT 'warning', replacement TEXT DEFAULT '',
      enabled INTEGER DEFAULT 1, platform TEXT DEFAULT 'all',
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
    CREATE TABLE compliance_reports (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, chapter_id TEXT,
      platform TEXT DEFAULT 'all', total_issues INTEGER DEFAULT 0,
      severity_breakdown TEXT DEFAULT '{}', issues TEXT NOT NULL DEFAULT '[]',
      status TEXT DEFAULT 'pending', created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
  `);
}

function seedProject(): string {
  const id = randomUUID();
  memDb.prepare("INSERT INTO projects (id, name) VALUES (?, 'Test')").run(id);
  return id;
}

describe('compliance routes', () => {
  let app: express.Express;
  let projectId: string;

  beforeEach(() => {
    memDb = new Database(':memory:');
    setupTables();
    projectId = seedProject();
    app = express();
    app.use(express.json());
    app.use('/api/projects/:projectId/compliance', complianceRouter);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (memDb) memDb.close();
  });

  describe('GET /rules', () => {
    it('returns empty array', async () => {
      const res = await request(app).get(`/api/projects/${projectId}/compliance/rules`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual([]);
    });
  });

  describe('POST /rules', () => {
    it('creates a rule', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/compliance/rules`)
        .send({ name: 'Test Rule', category: 'sensitive', pattern: 'badword', severity: 'warning' });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Test Rule');
    });

    it('validates required fields', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/compliance/rules`)
        .send({});
      expect(res.status).toBe(400);
    });
  });

  describe('PATCH /rules/:ruleId', () => {
    it('updates a rule', async () => {
      const createRes = await request(app)
        .post(`/api/projects/${projectId}/compliance/rules`)
        .send({ name: 'Old', category: 'sensitive', pattern: 'test' });
      const ruleId = createRes.body.data.id;

      const res = await request(app)
        .patch(`/api/projects/${projectId}/compliance/rules/${ruleId}`)
        .send({ name: 'New' });
      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('New');
    });
  });

  describe('DELETE /rules/:ruleId', () => {
    it('deletes a rule', async () => {
      const createRes = await request(app)
        .post(`/api/projects/${projectId}/compliance/rules`)
        .send({ name: 'Delete', category: 'sensitive', pattern: 'test' });
      const ruleId = createRes.body.data.id;

      const res = await request(app).delete(`/api/projects/${projectId}/compliance/rules/${ruleId}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('POST /check', () => {
    it('runs compliance check with no rules', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/compliance/check`)
        .send({ platform: 'all' });
      expect(res.status).toBe(200);
      expect(res.body.data.totalIssues).toBe(0);
    });
  });

  describe('GET /reports', () => {
    it('returns reports', async () => {
      const res = await request(app).get(`/api/projects/${projectId}/compliance/reports`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
