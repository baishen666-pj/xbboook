import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import cors from 'cors';
import { resetTestDb, getTestDb } from '../helpers/setup.js';

// We need to mock the database module before importing routes
// Use a simpler approach: test the actual server via HTTP

const BASE = 'http://localhost:3210';

describe('Projects API', () => {
  beforeEach(() => {
    resetTestDb();
  });

  describe('POST /api/projects', () => {
    it('should create a project', async () => {
      const res = await request(BASE)
        .post('/api/projects')
        .send({ name: 'My Novel', genre: 'fantasy', writing_mode: 'webnovel' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('My Novel');
      expect(res.body.data.id).toBeDefined();
    });

    it('should reject empty name', async () => {
      const res = await request(BASE)
        .post('/api/projects')
        .send({ name: '' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/projects', () => {
    it('should list projects', async () => {
      await request(BASE).post('/api/projects').send({ name: 'Novel A' });
      await request(BASE).post('/api/projects').send({ name: 'Novel B' });

      const res = await request(BASE).get('/api/projects');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('GET /api/projects/:id', () => {
    it('should get a single project', async () => {
      const create = await request(BASE).post('/api/projects').send({ name: 'Single' });
      const id = create.body.data.id;

      const res = await request(BASE).get(`/api/projects/${id}`);

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Single');
    });

    it('should return 404 for missing project', async () => {
      const res = await request(BASE).get('/api/projects/nonexistent');

      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/projects/:id', () => {
    it('should update a project', async () => {
      const create = await request(BASE).post('/api/projects').send({ name: 'Before' });
      const id = create.body.data.id;

      const res = await request(BASE).put(`/api/projects/${id}`).send({ name: 'After' });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('After');
    });
  });

  describe('DELETE /api/projects/:id', () => {
    it('should delete a project', async () => {
      const create = await request(BASE).post('/api/projects').send({ name: 'Delete Me' });
      const id = create.body.data.id;

      const res = await request(BASE).delete(`/api/projects/${id}`);

      expect(res.status).toBe(200);
    });
  });
});
