import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';

let memDb: Database.Database;

vi.mock('../../server/db/database.js', () => ({
  getDb: () => memDb,
}));

import * as characterRepo from '../../server/db/repositories/characterRepo.js';

function setupTables(): void {
  memDb.exec(`
    CREATE TABLE projects (
      id TEXT PRIMARY KEY, name TEXT NOT NULL,
      status TEXT DEFAULT 'active', sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE characters (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, name TEXT NOT NULL, nickname TEXT,
      role_type TEXT DEFAULT 'supporting', gender TEXT, age TEXT, appearance TEXT,
      personality TEXT, background TEXT, abilities TEXT, notes TEXT,
      sort_order INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
    CREATE TABLE character_relations (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL,
      character_a_id TEXT NOT NULL, character_b_id TEXT NOT NULL,
      relation_type TEXT NOT NULL, description TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (character_a_id) REFERENCES characters(id) ON DELETE CASCADE,
      FOREIGN KEY (character_b_id) REFERENCES characters(id) ON DELETE CASCADE
    );
  `);
}

function seedProject(): string {
  const id = randomUUID();
  memDb.prepare("INSERT INTO projects (id, name) VALUES (?, 'Test Novel')").run(id);
  return id;
}

describe('characterRepo', () => {
  beforeEach(() => {
    memDb = new Database(':memory:');
    memDb.pragma('foreign_keys = ON');
    setupTables();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (memDb) memDb.close();
  });

  describe('create', () => {
    it('creates a character with minimal data', () => {
      const projectId = seedProject();

      const char = characterRepo.create({ projectId, name: 'Alice' });

      expect(char).toBeDefined();
      expect(char.id).toBeTruthy();
      expect(char.name).toBe('Alice');
      expect(char.role_type).toBe('supporting');
      expect(char.sort_order).toBe(0);
    });

    it('creates a character with all fields', () => {
      const projectId = seedProject();

      const char = characterRepo.create({
        projectId,
        name: 'Bob',
        nickname: 'The Builder',
        roleType: 'protagonist',
        gender: 'male',
        age: '25',
        appearance: 'Tall, dark hair',
        personality: 'Brave and kind',
        background: 'Orphan raised by monks',
        abilities: 'Swordsmanship',
        notes: 'Main character',
      });

      expect(char.name).toBe('Bob');
      expect(char.nickname).toBe('The Builder');
      expect(char.role_type).toBe('protagonist');
      expect(char.gender).toBe('male');
      expect(char.age).toBe('25');
      expect(char.appearance).toBe('Tall, dark hair');
      expect(char.personality).toBe('Brave and kind');
      expect(char.background).toBe('Orphan raised by monks');
      expect(char.abilities).toBe('Swordsmanship');
      expect(char.notes).toBe('Main character');
    });

    it('auto-increments sort_order', () => {
      const projectId = seedProject();

      const c1 = characterRepo.create({ projectId, name: 'A' });
      const c2 = characterRepo.create({ projectId, name: 'B' });
      const c3 = characterRepo.create({ projectId, name: 'C' });

      expect(c1.sort_order).toBe(0);
      expect(c2.sort_order).toBe(1);
      expect(c3.sort_order).toBe(2);
    });

    it('handles unicode names', () => {
      const projectId = seedProject();

      const char = characterRepo.create({ projectId, name: '李明达' });

      expect(char.name).toBe('李明达');
    });
  });

  describe('findByProject', () => {
    it('returns characters for a project ordered by sort_order', () => {
      const p1 = seedProject();
      const p2 = seedProject();

      characterRepo.create({ projectId: p1, name: 'Alpha' });
      characterRepo.create({ projectId: p1, name: 'Beta' });
      characterRepo.create({ projectId: p2, name: 'Gamma' });

      const chars = characterRepo.findByProject(p1);

      expect(chars).toHaveLength(2);
      expect(chars[0].name).toBe('Alpha');
      expect(chars[1].name).toBe('Beta');
    });

    it('returns empty array when project has no characters', () => {
      const projectId = seedProject();

      expect(characterRepo.findByProject(projectId)).toEqual([]);
    });
  });

  describe('findById', () => {
    it('returns character by id', () => {
      const projectId = seedProject();
      const created = characterRepo.create({ projectId, name: 'FindMe' });

      const found = characterRepo.findById(created.id);

      expect(found).toBeDefined();
      expect(found!.name).toBe('FindMe');
    });

    it('returns undefined for non-existent id', () => {
      expect(characterRepo.findById('non-existent')).toBeUndefined();
    });
  });

  describe('update', () => {
    it('updates specified fields', () => {
      const projectId = seedProject();
      const created = characterRepo.create({ projectId, name: 'Original' });

      const updated = characterRepo.update(created.id, { name: 'Updated', gender: 'female' });

      expect(updated).toBeDefined();
      expect(updated!.name).toBe('Updated');
      expect(updated!.gender).toBe('female');
    });

    it('returns undefined for non-existent character', () => {
      const result = characterRepo.update('non-existent', { name: 'X' });

      expect(result).toBeUndefined();
    });

    it('returns existing character when no valid fields provided', () => {
      const projectId = seedProject();
      const created = characterRepo.create({ projectId, name: 'Same' });

      const result = characterRepo.update(created.id, { unknown_field: 'ignored' } as Record<string, unknown>);

      expect(result).toBeDefined();
      expect(result!.name).toBe('Same');
    });

    it('ignores undefined values', () => {
      const projectId = seedProject();
      const created = characterRepo.create({ projectId, name: 'Alice', gender: 'female' });

      const updated = characterRepo.update(created.id, { name: undefined, gender: 'male' });

      expect(updated!.name).toBe('Alice');
      expect(updated!.gender).toBe('male');
    });
  });

  describe('deleteById', () => {
    it('deletes a character and returns true', () => {
      const projectId = seedProject();
      const created = characterRepo.create({ projectId, name: 'DeleteMe' });

      const result = characterRepo.deleteById(created.id);

      expect(result).toBe(true);
      expect(characterRepo.findById(created.id)).toBeUndefined();
    });

    it('returns false for non-existent character', () => {
      expect(characterRepo.deleteById('non-existent')).toBe(false);
    });
  });

  describe('relations', () => {
    it('creates a relation between two characters', () => {
      const projectId = seedProject();
      const charA = characterRepo.create({ projectId, name: 'Alice' });
      const charB = characterRepo.create({ projectId, name: 'Bob' });

      const rel = characterRepo.createRelation({
        projectId,
        characterAId: charA.id,
        characterBId: charB.id,
        relationType: 'friend',
        description: 'Best friends since childhood',
      });

      expect(rel).toBeDefined();
      expect(rel.character_a_id).toBe(charA.id);
      expect(rel.character_b_id).toBe(charB.id);
      expect(rel.relation_type).toBe('friend');
      expect(rel.description).toBe('Best friends since childhood');
    });

    it('creates a relation without description', () => {
      const projectId = seedProject();
      const charA = characterRepo.create({ projectId, name: 'A' });
      const charB = characterRepo.create({ projectId, name: 'B' });

      const rel = characterRepo.createRelation({
        projectId,
        characterAId: charA.id,
        characterBId: charB.id,
        relationType: 'rival',
      });

      expect(rel.description).toBeNull();
    });

    it('finds relations for a project', () => {
      const projectId = seedProject();
      const charA = characterRepo.create({ projectId, name: 'A' });
      const charB = characterRepo.create({ projectId, name: 'B' });

      characterRepo.createRelation({ projectId, characterAId: charA.id, characterBId: charB.id, relationType: 'friend' });

      const rels = characterRepo.findRelations(projectId);

      expect(rels).toHaveLength(1);
    });

    it('finds relations for a specific character (both directions)', () => {
      const projectId = seedProject();
      const charA = characterRepo.create({ projectId, name: 'A' });
      const charB = characterRepo.create({ projectId, name: 'B' });
      const charC = characterRepo.create({ projectId, name: 'C' });

      characterRepo.createRelation({ projectId, characterAId: charA.id, characterBId: charB.id, relationType: 'friend' });
      characterRepo.createRelation({ projectId, characterAId: charC.id, characterBId: charA.id, relationType: 'mentor' });

      const rels = characterRepo.findRelationsForCharacter(charA.id);

      expect(rels).toHaveLength(2);
    });

    it('deletes a relation', () => {
      const projectId = seedProject();
      const charA = characterRepo.create({ projectId, name: 'A' });
      const charB = characterRepo.create({ projectId, name: 'B' });

      const rel = characterRepo.createRelation({ projectId, characterAId: charA.id, characterBId: charB.id, relationType: 'enemy' });

      expect(characterRepo.deleteRelation(rel.id)).toBe(true);
      expect(characterRepo.findRelations(projectId)).toHaveLength(0);
    });

    it('returns false when deleting non-existent relation', () => {
      expect(characterRepo.deleteRelation('non-existent')).toBe(false);
    });
  });
});
