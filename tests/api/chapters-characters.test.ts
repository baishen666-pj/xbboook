import { describe, it, expect } from 'vitest';
import request from 'supertest';

const BASE = 'http://localhost:3210';

describe('Chapters API', () => {
  let projectId: string;

  beforeAll(async () => {
    const res = await request(BASE).post('/api/projects').send({ name: 'Chapter Tests' });
    projectId = res.body.data.id;
  });

  it('should create a chapter', async () => {
    const res = await request(BASE)
      .post(`/api/projects/${projectId}/chapters`)
      .send({ title: 'Chapter 1' });

    expect(res.status).toBe(201);
    expect(res.body.data.title).toBe('Chapter 1');
  });

  it('should list chapters', async () => {
    await request(BASE).post(`/api/projects/${projectId}/chapters`).send({ title: 'Ch A' });
    await request(BASE).post(`/api/projects/${projectId}/chapters`).send({ title: 'Ch B' });

    const res = await request(BASE).get(`/api/projects/${projectId}/chapters`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
  });

  it('should save and read chapter content', async () => {
    const create = await request(BASE)
      .post(`/api/projects/${projectId}/chapters`)
      .send({ title: 'Content Ch' });
    const chId = create.body.data.id;

    const save = await request(BASE)
      .put(`/api/projects/${projectId}/chapters/${chId}/content`)
      .send({ content: 'Hello world, this is test content.' });

    expect(save.status).toBe(200);
    expect(save.body.data.word_count).toBeGreaterThan(0);

    const read = await request(BASE).get(`/api/projects/${projectId}/chapters/${chId}`);
    expect(read.body.data.content).toBe('Hello world, this is test content.');
  });

  it('should reorder chapters', async () => {
    const a = await request(BASE).post(`/api/projects/${projectId}/chapters`).send({ title: 'A' });
    const b = await request(BASE).post(`/api/projects/${projectId}/chapters`).send({ title: 'B' });

    const res = await request(BASE)
      .put(`/api/projects/${projectId}/chapters/reorder`)
      .send({ items: [{ id: b.body.data.id, sortOrder: 0 }, { id: a.body.data.id, sortOrder: 1 }] });

    expect(res.status).toBe(200);
  });

  it('should delete a chapter', async () => {
    const create = await request(BASE)
      .post(`/api/projects/${projectId}/chapters`)
      .send({ title: 'Delete Me' });
    const chId = create.body.data.id;

    const res = await request(BASE).delete(`/api/projects/${projectId}/chapters/${chId}`);
    expect(res.status).toBe(200);
  });
});

describe('Characters API', () => {
  let projectId: string;

  beforeAll(async () => {
    const res = await request(BASE).post('/api/projects').send({ name: 'Char Tests' });
    projectId = res.body.data.id;
  });

  it('should create a character with full fields', async () => {
    const res = await request(BASE)
      .post(`/api/projects/${projectId}/characters`)
      .send({
        name: 'Li Ming',
        nickname: 'Xiao Ming',
        roleType: 'protagonist',
        gender: 'male',
        personality: 'brave and kind',
        abilities: 'swordsmanship',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('Li Ming');
    expect(res.body.data.nickname).toBe('Xiao Ming');
    expect(res.body.data.role_type).toBe('protagonist');
  });

  it('should list characters with relations', async () => {
    const res = await request(BASE).get(`/api/projects/${projectId}/characters`);

    expect(res.status).toBe(200);
    expect(res.body.data.characters).toBeDefined();
    expect(res.body.data.relations).toBeDefined();
  });

  it('should update a character', async () => {
    const create = await request(BASE)
      .post(`/api/projects/${projectId}/characters`)
      .send({ name: 'Before' });
    const id = create.body.data.id;

    const res = await request(BASE)
      .put(`/api/projects/${projectId}/characters/${id}`)
      .send({ name: 'After', personality: 'changed' });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('After');
  });

  it('should create a relation between characters', async () => {
    const a = await request(BASE).post(`/api/projects/${projectId}/characters`).send({ name: 'A' });
    const b = await request(BASE).post(`/api/projects/${projectId}/characters`).send({ name: 'B' });

    const res = await request(BASE)
      .post(`/api/projects/${projectId}/characters/relations`)
      .send({ characterAId: a.body.data.id, characterBId: b.body.data.id, relationType: 'friend', description: 'best friends' });

    expect(res.status).toBe(201);
    expect(res.body.data.relation_type).toBe('friend');
  });

  it('should delete a character', async () => {
    const create = await request(BASE)
      .post(`/api/projects/${projectId}/characters`)
      .send({ name: 'Delete Me' });
    const id = create.body.data.id;

    const res = await request(BASE).delete(`/api/projects/${projectId}/characters/${id}`);
    expect(res.status).toBe(200);
  });
});
