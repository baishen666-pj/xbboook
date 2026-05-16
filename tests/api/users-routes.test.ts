import { describe, it, expect } from 'vitest';
import request from 'supertest';

const BASE = 'http://localhost:3210';

describe('Users Routes', () => {
  describe('POST /api/users/identify', () => {
    it('creates a new user', async () => {
      const res = await request(BASE)
        .post('/api/users/identify')
        .send({ username: 'testuser_new_001', displayName: 'Test User 001' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.username).toBe('testuser_new_001');
      expect(res.body.data.displayName).toBe('Test User 001');
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.avatarColor).toBeDefined();
    });

    it('returns existing user on duplicate username', async () => {
      await request(BASE)
        .post('/api/users/identify')
        .send({ username: 'dup_user_002', displayName: 'Original' });

      const res = await request(BASE)
        .post('/api/users/identify')
        .send({ username: 'dup_user_002', displayName: 'Duplicate' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      // Should return the original user, not create a new one
      expect(res.body.data.displayName).toBe('Original');
    });

    it('accepts custom avatarColor', async () => {
      const res = await request(BASE)
        .post('/api/users/identify')
        .send({ username: 'color_user_003', displayName: 'Color User', avatarColor: '#ec4899' });

      expect(res.status).toBe(200);
      expect(res.body.data.avatarColor).toBe('#ec4899');
    });

    it('rejects empty username', async () => {
      const res = await request(BASE)
        .post('/api/users/identify')
        .send({ username: '', displayName: 'No Name' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('rejects missing displayName', async () => {
      const res = await request(BASE)
        .post('/api/users/identify')
        .send({ username: 'nodisplay' });

      expect(res.status).toBe(400);
    });

    it('rejects invalid avatarColor format', async () => {
      const res = await request(BASE)
        .post('/api/users/identify')
        .send({ username: 'badcolor_004', displayName: 'Bad Color', avatarColor: 'not-a-color' });

      expect(res.status).toBe(400);
    });

    it('rejects username exceeding 20 chars', async () => {
      const res = await request(BASE)
        .post('/api/users/identify')
        .send({ username: 'a'.repeat(21), displayName: 'Long Name' });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/users/me', () => {
    it('returns user by userId', async () => {
      const createRes = await request(BASE)
        .post('/api/users/identify')
        .send({ username: 'me_user_005', displayName: 'Me User' });
      const userId = createRes.body.data.id;

      const res = await request(BASE).get(`/api/users/me?userId=${userId}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(userId);
      expect(res.body.data.username).toBe('me_user_005');
    });

    it('returns 400 when userId is missing', async () => {
      const res = await request(BASE).get('/api/users/me');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBeDefined();
    });

    it('returns 404 for non-existent user', async () => {
      const res = await request(BASE).get('/api/users/me?userId=nonexistent');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/users', () => {
    it('returns all users', async () => {
      await request(BASE)
        .post('/api/users/identify')
        .send({ username: 'list_user_006', displayName: 'List User 1' });

      const res = await request(BASE).get('/api/users');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });
  });
});
