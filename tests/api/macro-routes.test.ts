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

import keyboardMacrosRouter from '../../server/routes/keyboardMacros.js';

function setupTables(): void {
  memDb.exec(`
    CREATE TABLE projects (id TEXT PRIMARY KEY, name TEXT NOT NULL, status TEXT DEFAULT 'active', sort_order INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE keyboard_macros (
      id TEXT PRIMARY KEY, project_id TEXT, name TEXT NOT NULL,
      description TEXT DEFAULT '', trigger TEXT NOT NULL,
      actions TEXT NOT NULL DEFAULT '[]', enabled INTEGER DEFAULT 1,
      scope TEXT DEFAULT 'global', sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
  `);
}

function seedProject(): string {
  const id = randomUUID();
  memDb.prepare("INSERT INTO projects (id, name) VALUES (?, 'Test')").run(id);
  return id;
}

describe('keyboard macro routes', () => {
  let app: express.Express;
  let projectId: string;

  beforeEach(() => {
    memDb = new Database(':memory:');
    setupTables();
    projectId = seedProject();
    app = express();
    app.use(express.json());
    app.use('/api/projects/:projectId/macros', keyboardMacrosRouter);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (memDb) memDb.close();
  });

  describe('GET /', () => {
    it('returns macros', async () => {
      const res = await request(app).get(`/api/projects/${projectId}/macros`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual([]);
    });
  });

  describe('POST /', () => {
    it('creates a macro', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/macros`)
        .send({ name: 'Insert Break', trigger: 'ctrl+shift+b', actions: [{ type: 'insert', value: '***' }], scope: 'project' });
      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe('Insert Break');
      expect(res.body.data.trigger).toBe('ctrl+shift+b');
    });

    it('validates required fields', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/macros`)
        .send({ name: 'No Trigger' });
      expect(res.status).toBe(400);
    });
  });

  describe('PATCH /:macroId', () => {
    it('updates a macro', async () => {
      const createRes = await request(app)
        .post(`/api/projects/${projectId}/macros`)
        .send({ name: 'Old', trigger: 'ctrl+a', actions: [{ type: 'insert', value: 'x' }] });
      const macroId = createRes.body.data.id;

      const res = await request(app)
        .patch(`/api/projects/${projectId}/macros/${macroId}`)
        .send({ name: 'Updated Macro' });
      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Updated Macro');
    });
  });

  describe('DELETE /:macroId', () => {
    it('deletes a macro', async () => {
      const createRes = await request(app)
        .post(`/api/projects/${projectId}/macros`)
        .send({ name: 'Delete', trigger: 'ctrl+d', actions: [{ type: 'insert', value: 'x' }] });
      const res = await request(app).delete(`/api/projects/${projectId}/macros/${createRes.body.data.id}`);
      expect(res.status).toBe(200);
    });
  });
});
