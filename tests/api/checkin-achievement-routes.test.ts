import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import Database from 'better-sqlite3';
import { SCHEMA_SQL, POST_SCHEMA_ALTER_SQL } from '../../server/db/schemaDefinitions.js';

let testDb: Database.Database;
let app: any;

function createTestDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA_SQL);
  db.exec(POST_SCHEMA_ALTER_SQL);
  return db;
}

describe('Check-in and Achievement Routes', () => {
  let projectId: string;
  let chapterId: string;

  beforeEach(async () => {
    testDb = createTestDb();
    vi.doMock('../../server/db/database.js', () => ({ getDb: () => testDb, closeDb: () => {} }));
    vi.doMock('../../server/ws/presenceManager.js', () => ({
      generateToken: (uid: string) => `test-token-${uid}`,
      validateToken: (token: string) => { const m = token.match(/^test-token-(.+)$/); return m ? m[1] : null; },
      addConnection: vi.fn(), removeConnection: vi.fn(), getOnlineUsers: () => [], broadcastToProject: vi.fn(),
    }));
    vi.doMock('../../server/services/analyticsService.js', () => ({
      getDashboardData: () => ({ summary: { totalWords: 0, totalDays: 0, avgDaily: 0, bestDay: null }, velocity: [], chapterStatus: [], streak: { current: 0, longest: 0 }, target: { target: 0, current: 0, percentage: 0 }, peakHours: Array.from({ length: 24 }, (_, h) => ({ hour: h, count: 0 })) }),
      getCharacterAppearances: async () => [],
    }));
    vi.doMock('../../server/services/fileService.js', () => ({
      readChapter: vi.fn().mockResolvedValue('test content'),
      writeChapter: vi.fn(),
      writeVersion: vi.fn(),
      readVersion: vi.fn().mockResolvedValue(''),
      deleteVersionFile: vi.fn(),
      deleteVersionDir: vi.fn(),
      ensureProjectDir: vi.fn(),
      deleteProjectDir: vi.fn(),
      deleteChapter: vi.fn(),
    }));
    const mod = await import('../../server/app.js');
    app = mod.default;

    const projRes = await request(app).post('/api/projects').send({ name: 'Check-in Test' });
    projectId = projRes.body.data.id;

    const chRes = await request(app).post(`/api/projects/${projectId}/chapters`).send({ title: 'Chapter 1' });
    chapterId = chRes.body.data.id;
  });

  afterEach(() => {
    vi.doUnmock('../../server/db/database.js');
    vi.doUnmock('../../server/ws/presenceManager.js');
    vi.doUnmock('../../server/services/analyticsService.js');
    vi.doUnmock('../../server/services/fileService.js');
    vi.restoreAllMocks();
    if (testDb) testDb.close();
  });

  describe('POST /api/projects/:projectId/checkins', () => {
    it('should create a check-in for today', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/checkins`)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.checkIn).toBeDefined();
      expect(res.body.data.newAchievements).toBeDefined();
    });

    it('should create a check-in with a note', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/checkins`)
        .send({ note: 'Good writing day!' });

      expect(res.status).toBe(200);
      expect(res.body.data.checkIn.note).toBe('Good writing day!');
    });

    it('should upsert on second check-in same day', async () => {
      await request(app).post(`/api/projects/${projectId}/checkins`).send({});
      const res = await request(app)
        .post(`/api/projects/${projectId}/checkins`)
        .send({ note: 'Updated note' });

      expect(res.status).toBe(200);
      expect(res.body.data.checkIn.note).toBe('Updated note');
    });

    it('should award first_chapter and checkin_first achievements', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/checkins`)
        .send({});

      expect(res.status).toBe(200);
      const types = res.body.data.newAchievements.map((a: any) => a.badge_type);
      expect(types).toContain('first_chapter');
      expect(types).toContain('checkin_first');
    });
  });

  describe('GET /api/projects/:projectId/checkins/stats', () => {
    it('should return check-in stats', async () => {
      await request(app).post(`/api/projects/${projectId}/checkins`).send({});

      const res = await request(app)
        .get(`/api/projects/${projectId}/checkins/stats`);

      expect(res.status).toBe(200);
      expect(res.body.data.totalCheckIns).toBeGreaterThanOrEqual(1);
    });
  });

  describe('GET /api/projects/:projectId/checkins/calendar', () => {
    it('should return calendar data', async () => {
      await request(app).post(`/api/projects/${projectId}/checkins`).send({});

      const year = new Date().getFullYear();
      const res = await request(app)
        .get(`/api/projects/${projectId}/checkins/calendar?year=${year}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('GET /api/projects/:projectId/achievements', () => {
    it('should return achievement definitions and earned', async () => {
      await request(app).post(`/api/projects/${projectId}/checkins`).send({});

      const res = await request(app)
        .get(`/api/projects/${projectId}/achievements`);

      expect(res.status).toBe(200);
      expect(res.body.data.definitions.length).toBeGreaterThan(0);
      expect(res.body.data.earned.length).toBeGreaterThan(0);
    });

    it('should return empty earned for new project', async () => {
      const projRes = await request(app).post('/api/projects').send({ name: 'Fresh' });
      const freshId = projRes.body.data.id;

      const res = await request(app)
        .get(`/api/projects/${freshId}/achievements`);

      expect(res.status).toBe(200);
      expect(res.body.data.earned).toHaveLength(0);
    });
  });

  describe('GET /api/projects/:projectId/checkins/recent', () => {
    it('should return recent check-ins', async () => {
      await request(app).post(`/api/projects/${projectId}/checkins`).send({});

      const res = await request(app)
        .get(`/api/projects/${projectId}/checkins/recent?days=7`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });
  });
});
