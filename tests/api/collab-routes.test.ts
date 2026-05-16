import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';

const BASE = 'http://localhost:3210';

describe('Collab Routes', () => {
  let projectId: string;
  let userId: string;
  let userId2: string;
  let chapterId: string;

  beforeEach(async () => {
    // Create project
    const projRes = await request(BASE)
      .post('/api/projects')
      .send({ name: 'Collab Test Project', genre: 'fantasy' });
    projectId = projRes.body.data.id;

    // Create two users
    const user1Res = await request(BASE)
      .post('/api/users/identify')
      .send({ username: `collab_owner_${Date.now()}`, displayName: 'Owner' });
    userId = user1Res.body.data.id;

    const user2Res = await request(BASE)
      .post('/api/users/identify')
      .send({ username: `collab_writer_${Date.now()}`, displayName: 'Writer' });
    userId2 = user2Res.body.data.id;

    // Create a chapter
    const chRes = await request(BASE)
      .post(`/api/projects/${projectId}/chapters`)
      .send({ title: 'Collab Chapter' });
    chapterId = chRes.body.data.id;
  });

  describe('POST /api/projects/:projectId/collab/members', () => {
    it('adds first member as owner', async () => {
      const res = await request(BASE)
        .post(`/api/projects/${projectId}/collab/members`)
        .send({ userId });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.userId).toBe(userId);
    });

    it('adds subsequent members as writer by default', async () => {
      // First member becomes owner
      await request(BASE)
        .post(`/api/projects/${projectId}/collab/members`)
        .send({ userId });

      const res = await request(BASE)
        .post(`/api/projects/${projectId}/collab/members`)
        .send({ userId: userId2 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('rejects missing userId', async () => {
      const res = await request(BASE)
        .post(`/api/projects/${projectId}/collab/members`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('userId');
    });

    it('returns 404 for non-existent project', async () => {
      const res = await request(BASE)
        .post('/api/projects/nonexistent/collab/members')
        .send({ userId });

      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/projects/:projectId/collab/members', () => {
    it('returns members list', async () => {
      await request(BASE)
        .post(`/api/projects/${projectId}/collab/members`)
        .send({ userId });

      const res = await request(BASE).get(`/api/projects/${projectId}/collab/members`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('returns empty array for project with no members', async () => {
      const res = await request(BASE).get(`/api/projects/${projectId}/collab/members`);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });
  });

  describe('DELETE /api/projects/:projectId/collab/members/:userId', () => {
    it('removes a member', async () => {
      await request(BASE)
        .post(`/api/projects/${projectId}/collab/members`)
        .send({ userId });

      const res = await request(BASE)
        .delete(`/api/projects/${projectId}/collab/members/${userId}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify member is gone
      const membersRes = await request(BASE).get(`/api/projects/${projectId}/collab/members`);
      const members = membersRes.body.data;
      expect(members.find((m: any) => m.user_id === userId)).toBeUndefined();
    });
  });

  describe('GET /api/projects/:projectId/collab/online', () => {
    it('returns online users list', async () => {
      const res = await request(BASE).get(`/api/projects/${projectId}/collab/online`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('POST /api/projects/:projectId/collab/lock/:chapterId', () => {
    it('acquires a lock', async () => {
      const res = await request(BASE)
        .post(`/api/projects/${projectId}/collab/lock/${chapterId}`)
        .send({ userId });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.chapterId).toBe(chapterId);
      expect(res.body.data.userId).toBe(userId);
    });

    it('rejects missing userId', async () => {
      const res = await request(BASE)
        .post(`/api/projects/${projectId}/collab/lock/${chapterId}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('userId');
    });

    it('returns 409 when another user holds the lock', async () => {
      // User 1 acquires lock
      await request(BASE)
        .post(`/api/projects/${projectId}/collab/lock/${chapterId}`)
        .send({ userId });

      // User 2 tries to acquire same lock
      const res = await request(BASE)
        .post(`/api/projects/${projectId}/collab/lock/${chapterId}`)
        .send({ userId: userId2 });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('锁定');
    });

    it('allows same user to re-acquire (refresh)', async () => {
      await request(BASE)
        .post(`/api/projects/${projectId}/collab/lock/${chapterId}`)
        .send({ userId });

      const res = await request(BASE)
        .post(`/api/projects/${projectId}/collab/lock/${chapterId}`)
        .send({ userId });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('DELETE /api/projects/:projectId/collab/lock/:chapterId', () => {
    it('releases a lock', async () => {
      // First acquire
      await request(BASE)
        .post(`/api/projects/${projectId}/collab/lock/${chapterId}`)
        .send({ userId });

      const res = await request(BASE)
        .delete(`/api/projects/${projectId}/collab/lock/${chapterId}?userId=${userId}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('rejects missing userId', async () => {
      const res = await request(BASE)
        .delete(`/api/projects/${projectId}/collab/lock/${chapterId}`);

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/projects/:projectId/collab/locks', () => {
    it('returns locks for project', async () => {
      await request(BASE)
        .post(`/api/projects/${projectId}/collab/lock/${chapterId}`)
        .send({ userId });

      const res = await request(BASE).get(`/api/projects/${projectId}/collab/locks`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('returns empty array when no locks', async () => {
      const res = await request(BASE).get(`/api/projects/${projectId}/collab/locks`);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });
  });
});
