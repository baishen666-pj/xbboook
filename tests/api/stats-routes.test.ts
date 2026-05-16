import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';

const BASE = 'http://localhost:3210';

describe('Stats Routes', () => {
  let projectId: string;

  beforeEach(async () => {
    // Create a fresh project for each test
    const res = await request(BASE)
      .post('/api/projects')
      .send({ name: 'Stats Test Project', genre: 'fantasy', writing_mode: 'webnovel' });
    projectId = res.body.data.id;
  });

  describe('GET /api/projects/:projectId/stats', () => {
    it('returns summary and recent stats', async () => {
      const res = await request(BASE).get(`/api/projects/${projectId}/stats`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.summary).toBeDefined();
      expect(res.body.data.recent).toBeDefined();
      expect(res.body.data.summary.totalWords).toBe(0);
    });
  });

  describe('GET /api/projects/:projectId/stats/dashboard', () => {
    it('returns dashboard data', async () => {
      const res = await request(BASE).get(`/api/projects/${projectId}/stats/dashboard`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.summary).toBeDefined();
      expect(res.body.data.velocity).toBeDefined();
      expect(res.body.data.chapterStatus).toBeDefined();
      expect(res.body.data.streak).toBeDefined();
      expect(res.body.data.target).toBeDefined();
      expect(res.body.data.peakHours).toBeDefined();
      expect(res.body.data.peakHours).toHaveLength(24);
    });

    it('respects days query parameter', async () => {
      const res = await request(BASE).get(`/api/projects/${projectId}/stats/dashboard?days=7`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('clamps days parameter between 1 and 365', async () => {
      const res = await request(BASE).get(`/api/projects/${projectId}/stats/dashboard?days=0`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const resLarge = await request(BASE).get(`/api/projects/${projectId}/stats/dashboard?days=999`);
      expect(resLarge.status).toBe(200);
    });
  });

  describe('GET /api/projects/:projectId/stats/characters', () => {
    it('returns empty array for project with no characters', async () => {
      const res = await request(BASE).get(`/api/projects/${projectId}/stats/characters`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual([]);
    });
  });

  describe('POST /api/projects/:projectId/stats', () => {
    it('creates a daily stat', async () => {
      const res = await request(BASE)
        .post(`/api/projects/${projectId}/stats`)
        .send({ date: '2026-01-15', wordsAdded: 500, wordsTotal: 5000, writingTimeMs: 1800000, chaptersWorked: 2 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.words_added).toBe(500);
    });

    it('rejects invalid date format', async () => {
      const res = await request(BASE)
        .post(`/api/projects/${projectId}/stats`)
        .send({ date: 'not-a-date', wordsAdded: 500 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('rejects negative wordsAdded', async () => {
      const res = await request(BASE)
        .post(`/api/projects/${projectId}/stats`)
        .send({ date: '2026-01-15', wordsAdded: -10 });

      expect(res.status).toBe(400);
    });

    it('increments existing stat on same date', async () => {
      await request(BASE)
        .post(`/api/projects/${projectId}/stats`)
        .send({ date: '2026-01-15', wordsAdded: 200, wordsTotal: 5000 });

      const res = await request(BASE)
        .post(`/api/projects/${projectId}/stats`)
        .send({ date: '2026-01-15', wordsAdded: 300, wordsTotal: 5300 });

      expect(res.status).toBe(200);
      expect(res.body.data.words_added).toBe(500);
    });
  });

  describe('POST /api/projects/:projectId/stats/session', () => {
    let chapterId: string;

    beforeEach(async () => {
      const chRes = await request(BASE)
        .post(`/api/projects/${projectId}/chapters`)
        .send({ title: 'Session Chapter' });
      chapterId = chRes.body.data.id;
    });

    it('starts a writing session', async () => {
      const res = await request(BASE)
        .post(`/api/projects/${projectId}/stats/session`)
        .send({ chapterId, wordsStart: 100 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.chapter_id).toBe(chapterId);
      expect(res.body.data.words_start).toBe(100);
      expect(res.body.data.ended_at).toBeNull();
    });

    it('rejects missing chapterId', async () => {
      const res = await request(BASE)
        .post(`/api/projects/${projectId}/stats/session`)
        .send({ wordsStart: 100 });

      expect(res.status).toBe(400);
    });

    it('rejects negative wordsStart', async () => {
      const res = await request(BASE)
        .post(`/api/projects/${projectId}/stats/session`)
        .send({ chapterId, wordsStart: -5 });

      expect(res.status).toBe(400);
    });
  });

  describe('PUT /api/projects/:projectId/stats/session/:sessionId', () => {
    let chapterId: string;
    let sessionId: string;

    beforeEach(async () => {
      const chRes = await request(BASE)
        .post(`/api/projects/${projectId}/chapters`)
        .send({ title: 'Session Chapter' });
      chapterId = chRes.body.data.id;

      const sessRes = await request(BASE)
        .post(`/api/projects/${projectId}/stats/session`)
        .send({ chapterId, wordsStart: 100 });
      sessionId = sessRes.body.data.id;
    });

    it('ends a writing session', async () => {
      const res = await request(BASE)
        .put(`/api/projects/${projectId}/stats/session/${sessionId}`)
        .send({ wordsEnd: 350 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.words_end).toBe(350);
      expect(res.body.data.ended_at).not.toBeNull();
      expect(res.body.data.duration_ms).toBeGreaterThan(0);
    });

    it('returns 404 for non-existent session', async () => {
      const res = await request(BASE)
        .put(`/api/projects/${projectId}/stats/session/nonexistent`)
        .send({ wordsEnd: 100 });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('rejects negative wordsEnd', async () => {
      const res = await request(BASE)
        .put(`/api/projects/${projectId}/stats/session/${sessionId}`)
        .send({ wordsEnd: -10 });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/projects/:projectId/stats/recent', () => {
    it('returns recent stats', async () => {
      const res = await request(BASE).get(`/api/projects/${projectId}/stats/recent?days=7`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });
});
