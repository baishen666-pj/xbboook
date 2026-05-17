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

import platformPublishRouter from '../../server/routes/platformPublish.js';

function setupTables(): void {
  memDb.exec(`
    CREATE TABLE projects (id TEXT PRIMARY KEY, name TEXT NOT NULL, status TEXT DEFAULT 'active', sort_order INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE platform_publish_configs (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL,
      platform TEXT NOT NULL CHECK(platform IN ('qidian','fanqie','jinjiang','zongheng','other')),
      config TEXT NOT NULL DEFAULT '{}', last_export_at TEXT,
      chapter_mapping TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      UNIQUE(project_id, platform)
    );
  `);
}

function seedProject(): string {
  const id = randomUUID();
  memDb.prepare("INSERT INTO projects (id, name) VALUES (?, 'Test')").run(id);
  return id;
}

describe('platform publish routes', () => {
  let app: express.Express;
  let projectId: string;

  beforeEach(() => {
    memDb = new Database(':memory:');
    setupTables();
    projectId = seedProject();
    app = express();
    app.use(express.json());
    app.use('/api/projects/:projectId/platform-publish', platformPublishRouter);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (memDb) memDb.close();
  });

  describe('GET /platforms', () => {
    it('returns available platforms', async () => {
      const res = await request(app).get(`/api/projects/${projectId}/platform-publish/platforms`);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(5);
      expect(res.body.data[0]).toHaveProperty('id');
      expect(res.body.data[0]).toHaveProperty('name');
    });
  });

  describe('POST /configs', () => {
    it('creates a config', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/platform-publish/configs`)
        .send({ platform: 'qidian', config: { maxLength: 3000 } });
      expect(res.status).toBe(201);
      expect(res.body.data.platform).toBe('qidian');
    });
  });

  describe('GET /configs', () => {
    it('returns configs', async () => {
      await request(app)
        .post(`/api/projects/${projectId}/platform-publish/configs`)
        .send({ platform: 'qidian' });
      const res = await request(app).get(`/api/projects/${projectId}/platform-publish/configs`);
      expect(res.body.data).toHaveLength(1);
    });
  });

  describe('DELETE /configs/:platform', () => {
    it('deletes a config', async () => {
      await request(app)
        .post(`/api/projects/${projectId}/platform-publish/configs`)
        .send({ platform: 'fanqie' });
      const res = await request(app).delete(`/api/projects/${projectId}/platform-publish/configs/fanqie`);
      expect(res.status).toBe(200);
    });
  });

  describe('POST /export', () => {
    it('exports content', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/platform-publish/export`)
        .send({ platform: 'qidian' });
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/plain');
    });
  });
});
