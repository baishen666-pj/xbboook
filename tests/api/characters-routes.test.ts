import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { setupTestServer } from '../helpers/testServer.js';

const getApp = setupTestServer();

async function createProject() {
  const app = await getApp();
  const res = await request(app).post('/api/projects').send({ name: 'Test Project' });
  return res.body.data.id;
}

async function createCharacter(projectId: string, overrides: Record<string, unknown> = {}) {
  const app = await getApp();
  const res = await request(app)
    .post(`/api/projects/${projectId}/characters`)
    .send({ name: 'Test Character', ...overrides });
  return res;
}

describe('Characters Routes', () => {
  let projectId: string;

  beforeEach(async () => {
    projectId = await createProject();
  });

  // ─── GET / (list) ──────────────────────────────────────────────

  describe('GET /api/projects/:projectId/characters', () => {
    it('returns empty characters and relations for new project', async () => {
      const app = await getApp();
      const res = await request(app).get(`/api/projects/${projectId}/characters`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.characters).toEqual([]);
      expect(res.body.data.relations).toEqual([]);
    });

    it('returns created characters in the list', async () => {
      await createCharacter(projectId, { name: 'Alice' });
      await createCharacter(projectId, { name: 'Bob' });

      const app = await getApp();
      const res = await request(app).get(`/api/projects/${projectId}/characters`);

      expect(res.status).toBe(200);
      expect(res.body.data.characters).toHaveLength(2);
      const names = res.body.data.characters.map((c: any) => c.name);
      expect(names).toContain('Alice');
      expect(names).toContain('Bob');
    });

    it('returns relations alongside characters', async () => {
      const charA = await createCharacter(projectId, { name: 'A' });
      const charB = await createCharacter(projectId, { name: 'B' });

      const app = await getApp();
      await request(app)
        .post(`/api/projects/${projectId}/characters/relations`)
        .send({
          characterAId: charA.body.data.id,
          characterBId: charB.body.data.id,
          relationType: 'rival',
        });

      const res = await request(app).get(`/api/projects/${projectId}/characters`);

      expect(res.status).toBe(200);
      expect(res.body.data.relations).toHaveLength(1);
      expect(res.body.data.relations[0].relation_type).toBe('rival');
    });

    it('does not leak characters from other projects', async () => {
      await createCharacter(projectId, { name: 'InProject' });

      const otherProjectId = await createProject();
      await createCharacter(otherProjectId, { name: 'OtherProject' });

      const app = await getApp();
      const res = await request(app).get(`/api/projects/${projectId}/characters`);

      expect(res.status).toBe(200);
      expect(res.body.data.characters).toHaveLength(1);
      expect(res.body.data.characters[0].name).toBe('InProject');
    });
  });

  // ─── GET /:id (single) ─────────────────────────────────────────

  describe('GET /api/projects/:projectId/characters/:id', () => {
    it('returns a single character by id', async () => {
      const createRes = await createCharacter(projectId, {
        name: 'Hero',
        nickname: 'The Brave',
        roleType: 'protagonist',
        gender: 'male',
        age: '25',
        appearance: 'Tall with dark hair',
        personality: 'Courageous and kind',
        background: 'Raised in a small village',
        abilities: 'Sword mastery',
        notes: 'Main character of arc 1',
      });

      const id = createRes.body.data.id;
      const app = await getApp();
      const res = await request(app).get(`/api/projects/${projectId}/characters/${id}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.character).toBeDefined();
      expect(res.body.data.character.name).toBe('Hero');
      expect(res.body.data.character.nickname).toBe('The Brave');
      expect(res.body.data.character.role_type).toBe('protagonist');
      expect(res.body.data.character.gender).toBe('male');
      expect(res.body.data.character.age).toBe('25');
      expect(res.body.data.character.appearance).toBe('Tall with dark hair');
      expect(res.body.data.character.personality).toBe('Courageous and kind');
      expect(res.body.data.character.background).toBe('Raised in a small village');
      expect(res.body.data.character.abilities).toBe('Sword mastery');
      expect(res.body.data.character.notes).toBe('Main character of arc 1');
    });

    it('includes relations for the character', async () => {
      const charA = await createCharacter(projectId, { name: 'A' });
      const charB = await createCharacter(projectId, { name: 'B' });

      const app = await getApp();
      await request(app)
        .post(`/api/projects/${projectId}/characters/relations`)
        .send({
          characterAId: charA.body.data.id,
          characterBId: charB.body.data.id,
          relationType: 'sibling',
          description: 'Brothers',
        });

      const res = await request(app).get(
        `/api/projects/${projectId}/characters/${charA.body.data.id}`,
      );

      expect(res.status).toBe(200);
      expect(res.body.data.relations).toHaveLength(1);
      expect(res.body.data.relations[0].relation_type).toBe('sibling');
    });

    it('returns 404 for non-existent character', async () => {
      const app = await getApp();
      const res = await request(app).get(
        `/api/projects/${projectId}/characters/nonexistent-id`,
      );

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBeDefined();
    });
  });

  // ─── POST / (create) ───────────────────────────────────────────

  describe('POST /api/projects/:projectId/characters', () => {
    it('creates a character with only required name field', async () => {
      const res = await createCharacter(projectId, { name: 'Minimal' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Minimal');
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.role_type).toBe('supporting');
      expect(res.body.data.sort_order).toBeDefined();
    });

    it('creates a character with all fields', async () => {
      const res = await createCharacter(projectId, {
        name: 'Full Character',
        nickname: 'FullNick',
        roleType: 'antagonist',
        gender: 'female',
        age: '30',
        appearance: 'Short red hair',
        personality: 'Cunning and ambitious',
        background: 'Born into nobility',
        abilities: 'Dark magic',
        notes: 'Primary antagonist',
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Full Character');
      expect(res.body.data.nickname).toBe('FullNick');
      expect(res.body.data.role_type).toBe('antagonist');
      expect(res.body.data.gender).toBe('female');
      expect(res.body.data.age).toBe('30');
      expect(res.body.data.appearance).toBe('Short red hair');
      expect(res.body.data.personality).toBe('Cunning and ambitious');
      expect(res.body.data.background).toBe('Born into nobility');
      expect(res.body.data.abilities).toBe('Dark magic');
      expect(res.body.data.notes).toBe('Primary antagonist');
    });

    it('accepts each valid roleType', async () => {
      const roles = ['protagonist', 'antagonist', 'supporting', 'minor'] as const;

      for (const role of roles) {
        const res = await createCharacter(projectId, {
          name: `Char-${role}`,
          roleType: role,
        });
        expect(res.status).toBe(201);
        expect(res.body.data.role_type).toBe(role);
      }
    });

    it('defaults roleType to supporting when omitted', async () => {
      const res = await createCharacter(projectId, { name: 'No Role' });

      expect(res.status).toBe(201);
      expect(res.body.data.role_type).toBe('supporting');
    });

    it('rejects missing name', async () => {
      const app = await getApp();
      const res = await request(app)
        .post(`/api/projects/${projectId}/characters`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('rejects empty name', async () => {
      const res = await createCharacter(projectId, { name: '' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('rejects name exceeding 200 characters', async () => {
      const res = await createCharacter(projectId, { name: 'x'.repeat(201) });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('rejects invalid roleType', async () => {
      const res = await createCharacter(projectId, {
        name: 'Bad Role',
        roleType: 'hero',
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('assigns incrementing sort_order', async () => {
      const first = await createCharacter(projectId, { name: 'First' });
      const second = await createCharacter(projectId, { name: 'Second' });

      expect(first.body.data.sort_order).toBeLessThan(second.body.data.sort_order);
    });
  });

  // ─── PUT /:id (update) ─────────────────────────────────────────

  describe('PUT /api/projects/:projectId/characters/:id', () => {
    it('updates character name', async () => {
      const createRes = await createCharacter(projectId, { name: 'Before' });
      const id = createRes.body.data.id;

      const app = await getApp();
      const res = await request(app)
        .put(`/api/projects/${projectId}/characters/${id}`)
        .send({ name: 'After' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('After');
    });

    it('updates with snake_case fields', async () => {
      const createRes = await createCharacter(projectId, { name: 'ToUpdate' });
      const id = createRes.body.data.id;

      const app = await getApp();
      const res = await request(app)
        .put(`/api/projects/${projectId}/characters/${id}`)
        .send({
          name: 'Updated Name',
          nickname: 'New Nick',
          role_type: 'minor',
          gender: 'non-binary',
          age: '42',
          appearance: 'Updated appearance',
          personality: 'Updated personality',
          background: 'Updated background',
          abilities: 'Updated abilities',
          notes: 'Updated notes',
          sort_order: 99,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Updated Name');
      expect(res.body.data.nickname).toBe('New Nick');
      expect(res.body.data.role_type).toBe('minor');
      expect(res.body.data.gender).toBe('non-binary');
      expect(res.body.data.age).toBe('42');
      expect(res.body.data.appearance).toBe('Updated appearance');
      expect(res.body.data.personality).toBe('Updated personality');
      expect(res.body.data.background).toBe('Updated background');
      expect(res.body.data.abilities).toBe('Updated abilities');
      expect(res.body.data.notes).toBe('Updated notes');
      expect(res.body.data.sort_order).toBe(99);
    });

    it('returns unchanged character when body is empty', async () => {
      const createRes = await createCharacter(projectId, { name: 'No Change' });
      const id = createRes.body.data.id;

      const app = await getApp();
      const res = await request(app)
        .put(`/api/projects/${projectId}/characters/${id}`)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('No Change');
    });

    it('returns 404 for non-existent character', async () => {
      const app = await getApp();
      const res = await request(app)
        .put(`/api/projects/${projectId}/characters/nonexistent`)
        .send({ name: 'Ghost' });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('rejects invalid role_type value on update', async () => {
      const createRes = await createCharacter(projectId, { name: 'Validate' });
      const id = createRes.body.data.id;

      const app = await getApp();
      const res = await request(app)
        .put(`/api/projects/${projectId}/characters/${id}`)
        .send({ role_type: 'superhero' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('rejects name exceeding 200 characters on update', async () => {
      const createRes = await createCharacter(projectId, { name: 'Long Name' });
      const id = createRes.body.data.id;

      const app = await getApp();
      const res = await request(app)
        .put(`/api/projects/${projectId}/characters/${id}`)
        .send({ name: 'y'.repeat(201) });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('rejects negative sort_order', async () => {
      const createRes = await createCharacter(projectId, { name: 'Order Test' });
      const id = createRes.body.data.id;

      const app = await getApp();
      const res = await request(app)
        .put(`/api/projects/${projectId}/characters/${id}`)
        .send({ sort_order: -1 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  // ─── DELETE /:id ───────────────────────────────────────────────

  describe('DELETE /api/projects/:projectId/characters/:id', () => {
    it('deletes an existing character', async () => {
      const createRes = await createCharacter(projectId, { name: 'Delete Me' });
      const id = createRes.body.data.id;

      const app = await getApp();
      const res = await request(app).delete(
        `/api/projects/${projectId}/characters/${id}`,
      );

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const listRes = await request(app).get(`/api/projects/${projectId}/characters`);
      const ids = listRes.body.data.characters.map((c: any) => c.id);
      expect(ids).not.toContain(id);
    });

    it('returns 404 for non-existent character', async () => {
      const app = await getApp();
      const res = await request(app).delete(
        `/api/projects/${projectId}/characters/nonexistent`,
      );

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('cascades and removes relations when character is deleted', async () => {
      const charA = await createCharacter(projectId, { name: 'A' });
      const charB = await createCharacter(projectId, { name: 'B' });
      const aId = charA.body.data.id;
      const bId = charB.body.data.id;

      const app = await getApp();
      await request(app)
        .post(`/api/projects/${projectId}/characters/relations`)
        .send({
          characterAId: aId,
          characterBId: bId,
          relationType: 'friend',
        });

      await request(app).delete(`/api/projects/${projectId}/characters/${aId}`);

      const listRes = await request(app).get(`/api/projects/${projectId}/characters`);
      expect(listRes.body.data.relations).toHaveLength(0);
    });
  });

  // ─── POST /relations ───────────────────────────────────────────

  describe('POST /api/projects/:projectId/characters/relations', () => {
    it('creates a relation between two characters', async () => {
      const charA = await createCharacter(projectId, { name: 'Alpha' });
      const charB = await createCharacter(projectId, { name: 'Beta' });
      const aId = charA.body.data.id;
      const bId = charB.body.data.id;

      const app = await getApp();
      const res = await request(app)
        .post(`/api/projects/${projectId}/characters/relations`)
        .send({
          characterAId: aId,
          characterBId: bId,
          relationType: 'friend',
          description: 'Childhood friends',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.character_a_id).toBe(aId);
      expect(res.body.data.character_b_id).toBe(bId);
      expect(res.body.data.relation_type).toBe('friend');
      expect(res.body.data.description).toBe('Childhood friends');
      expect(res.body.data.id).toBeDefined();
    });

    it('creates a relation without description', async () => {
      const charA = await createCharacter(projectId, { name: 'A' });
      const charB = await createCharacter(projectId, { name: 'B' });

      const app = await getApp();
      const res = await request(app)
        .post(`/api/projects/${projectId}/characters/relations`)
        .send({
          characterAId: charA.body.data.id,
          characterBId: charB.body.data.id,
          relationType: 'enemy',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.relation_type).toBe('enemy');
      expect(res.body.data.description).toBeNull();
    });

    it('rejects missing characterAId', async () => {
      const charB = await createCharacter(projectId, { name: 'B' });

      const app = await getApp();
      const res = await request(app)
        .post(`/api/projects/${projectId}/characters/relations`)
        .send({
          characterBId: charB.body.data.id,
          relationType: 'friend',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('rejects missing characterBId', async () => {
      const charA = await createCharacter(projectId, { name: 'A' });

      const app = await getApp();
      const res = await request(app)
        .post(`/api/projects/${projectId}/characters/relations`)
        .send({
          characterAId: charA.body.data.id,
          relationType: 'friend',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('rejects missing relationType', async () => {
      const charA = await createCharacter(projectId, { name: 'A' });
      const charB = await createCharacter(projectId, { name: 'B' });

      const app = await getApp();
      const res = await request(app)
        .post(`/api/projects/${projectId}/characters/relations`)
        .send({
          characterAId: charA.body.data.id,
          characterBId: charB.body.data.id,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('rejects empty relationType', async () => {
      const charA = await createCharacter(projectId, { name: 'A' });
      const charB = await createCharacter(projectId, { name: 'B' });

      const app = await getApp();
      const res = await request(app)
        .post(`/api/projects/${projectId}/characters/relations`)
        .send({
          characterAId: charA.body.data.id,
          characterBId: charB.body.data.id,
          relationType: '',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('rejects relationType exceeding 200 characters', async () => {
      const charA = await createCharacter(projectId, { name: 'A' });
      const charB = await createCharacter(projectId, { name: 'B' });

      const app = await getApp();
      const res = await request(app)
        .post(`/api/projects/${projectId}/characters/relations`)
        .send({
          characterAId: charA.body.data.id,
          characterBId: charB.body.data.id,
          relationType: 'r'.repeat(201),
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('rejects description exceeding 2000 characters', async () => {
      const charA = await createCharacter(projectId, { name: 'A' });
      const charB = await createCharacter(projectId, { name: 'B' });

      const app = await getApp();
      const res = await request(app)
        .post(`/api/projects/${projectId}/characters/relations`)
        .send({
          characterAId: charA.body.data.id,
          characterBId: charB.body.data.id,
          relationType: 'friend',
          description: 'd'.repeat(2001),
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('rejects non-UUID characterAId', async () => {
      const charB = await createCharacter(projectId, { name: 'B' });

      const app = await getApp();
      const res = await request(app)
        .post(`/api/projects/${projectId}/characters/relations`)
        .send({
          characterAId: 'not-a-uuid',
          characterBId: charB.body.data.id,
          relationType: 'friend',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('rejects non-UUID characterBId', async () => {
      const charA = await createCharacter(projectId, { name: 'A' });

      const app = await getApp();
      const res = await request(app)
        .post(`/api/projects/${projectId}/characters/relations`)
        .send({
          characterAId: charA.body.data.id,
          characterBId: 'not-a-uuid',
          relationType: 'friend',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  // ─── DELETE /relations/:relationId ─────────────────────────────

  describe('DELETE /api/projects/:projectId/characters/relations/:relationId', () => {
    it('deletes an existing relation', async () => {
      const charA = await createCharacter(projectId, { name: 'A' });
      const charB = await createCharacter(projectId, { name: 'B' });

      const app = await getApp();
      const relRes = await request(app)
        .post(`/api/projects/${projectId}/characters/relations`)
        .send({
          characterAId: charA.body.data.id,
          characterBId: charB.body.data.id,
          relationType: 'mentor',
        });
      const relationId = relRes.body.data.id;

      const res = await request(app).delete(
        `/api/projects/${projectId}/characters/relations/${relationId}`,
      );

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const listRes = await request(app).get(`/api/projects/${projectId}/characters`);
      expect(listRes.body.data.relations).toHaveLength(0);
    });

    it('returns 404 for non-existent relation', async () => {
      const app = await getApp();
      const res = await request(app).delete(
        `/api/projects/${projectId}/characters/relations/nonexistent`,
      );

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  // ─── Cross-cutting: CRUD lifecycle ─────────────────────────────

  describe('CRUD lifecycle', () => {
    it('full create-read-update-delete cycle', async () => {
      const app = await getApp();

      // Create
      const createRes = await request(app)
        .post(`/api/projects/${projectId}/characters`)
        .send({ name: 'Lifecycle', roleType: 'protagonist' });
      expect(createRes.status).toBe(201);
      const id = createRes.body.data.id;

      // Read
      const getRes = await request(app).get(
        `/api/projects/${projectId}/characters/${id}`,
      );
      expect(getRes.status).toBe(200);
      expect(getRes.body.data.character.name).toBe('Lifecycle');

      // Update
      const updateRes = await request(app)
        .put(`/api/projects/${projectId}/characters/${id}`)
        .send({ name: 'Renamed', role_type: 'antagonist' });
      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.name).toBe('Renamed');
      expect(updateRes.body.data.role_type).toBe('antagonist');

      // Verify update persisted
      const verifyRes = await request(app).get(
        `/api/projects/${projectId}/characters/${id}`,
      );
      expect(verifyRes.body.data.character.name).toBe('Renamed');

      // Delete
      const deleteRes = await request(app).delete(
        `/api/projects/${projectId}/characters/${id}`,
      );
      expect(deleteRes.status).toBe(200);

      // Verify deleted
      const goneRes = await request(app).get(
        `/api/projects/${projectId}/characters/${id}`,
      );
      expect(goneRes.status).toBe(404);
    });

    it('relation CRUD lifecycle', async () => {
      const app = await getApp();
      const charA = await createCharacter(projectId, { name: 'A' });
      const charB = await createCharacter(projectId, { name: 'B' });

      // Create relation
      const createRelRes = await request(app)
        .post(`/api/projects/${projectId}/characters/relations`)
        .send({
          characterAId: charA.body.data.id,
          characterBId: charB.body.data.id,
          relationType: 'ally',
          description: ' wartime comrades',
        });
      expect(createRelRes.status).toBe(201);
      const relationId = createRelRes.body.data.id;

      // Verify in list
      const listRes = await request(app).get(`/api/projects/${projectId}/characters`);
      expect(listRes.body.data.relations).toHaveLength(1);

      // Verify in single character view
      const charRes = await request(app).get(
        `/api/projects/${projectId}/characters/${charA.body.data.id}`,
      );
      expect(charRes.body.data.relations).toHaveLength(1);
      expect(charRes.body.data.relations[0].description).toBe(' wartime comrades');

      // Delete relation
      const deleteRes = await request(app).delete(
        `/api/projects/${projectId}/characters/relations/${relationId}`,
      );
      expect(deleteRes.status).toBe(200);

      // Verify deleted
      const afterRes = await request(app).get(`/api/projects/${projectId}/characters`);
      expect(afterRes.body.data.relations).toHaveLength(0);
    });
  });
});
