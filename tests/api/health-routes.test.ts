import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import supertest from 'supertest';
import Database from 'better-sqlite3';
import express from 'express';
import { SCHEMA_SQL } from '../../server/db/schemaDefinitions.js';

function createTestDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.exec(SCHEMA_SQL);
  return db;
}

async function createTestApp(db: Database.Database) {
  vi.doMock('../../server/db/database.js', () => ({
    getDb: () => db,
  }));

  const { default: healthRouter } = await import('../../server/routes/health.js');
  const app = express();
  app.use(express.json());
  app.use('/api/health', healthRouter);
  return app;
}

describe('GET /api/health', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
  });

  afterEach(() => {
    db.close();
    vi.doUnmock('../../server/db/database.js');
  });

  it('returns healthy status', async () => {
    const app = await createTestApp(db);
    const res = await supertest(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('healthy');
    expect(res.body.data.db).toBe('ok');
    expect(res.body.data.uptime).toBeTypeOf('number');
    expect(res.body.data.version).toBe('0.1.0');
  });

  it('includes timestamp', async () => {
    const app = await createTestApp(db);
    const res = await supertest(app).get('/api/health');

    expect(res.body.data.timestamp).toBeTruthy();
    expect(new Date(res.body.data.timestamp).getTime()).not.toBeNaN();
  });
});