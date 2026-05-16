import { v4 as uuid } from 'uuid';
import { getDb } from '../database.js';
import type { Character, CharacterRelation } from '../../types/index.js';

export function findByProject(projectId: string): Character[] {
  const db = getDb();
  return db
    .prepare('SELECT * FROM characters WHERE project_id = ? ORDER BY sort_order ASC')
    .all(projectId) as Character[];
}

export function findById(id: string): Character | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM characters WHERE id = ?').get(id) as Character | undefined;
}

const CHARACTER_UPDATE_FIELDS = new Set([
  'name', 'nickname', 'role_type', 'gender', 'age',
  'appearance', 'personality', 'background', 'abilities', 'notes', 'sort_order',
  'speech_style', 'verbal_tics', 'vocabulary_level', 'sentence_length_pref', 'emotional_expressiveness', 'voice_examples',
]);

export function create(data: {
  projectId: string;
  name: string;
  nickname?: string;
  roleType?: string;
  gender?: string;
  age?: string;
  appearance?: string;
  personality?: string;
  background?: string;
  abilities?: string;
  notes?: string;
}): Character {
  const db = getDb();
  const id = uuid();
  const now = new Date().toISOString();

  const maxOrder = db
    .prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM characters WHERE project_id = ?')
    .get(data.projectId) as { next: number };

  db.prepare(`
    INSERT INTO characters (id, project_id, name, nickname, role_type, gender, age, appearance, personality, background, abilities, notes, sort_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    data.projectId,
    data.name,
    data.nickname ?? null,
    data.roleType ?? 'supporting',
    data.gender ?? null,
    data.age ?? null,
    data.appearance ?? null,
    data.personality ?? null,
    data.background ?? null,
    data.abilities ?? null,
    data.notes ?? null,
    maxOrder.next,
    now,
    now,
  );

  const created = findById(id);
  if (!created) throw new Error(`Failed to retrieve created character: ${id}`);
  return created;
}

export function update(
  id: string,
  data: Partial<{
    name: string;
    nickname: string;
    role_type: string;
    gender: string;
    age: string;
    appearance: string;
    personality: string;
    background: string;
    abilities: string;
    notes: string;
    sort_order: number;
    speech_style: string;
    verbal_tics: string;
    vocabulary_level: string;
    sentence_length_pref: string;
    emotional_expressiveness: string;
    voice_examples: string;
  }>,
): Character | undefined {
  const db = getDb();
  const existing = findById(id);
  if (!existing) return undefined;

  const fields: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined && CHARACTER_UPDATE_FIELDS.has(key)) {
      fields.push(`${key} = ?`);
      values.push(value);
    }
  }

  if (fields.length === 0) return existing;

  fields.push("updated_at = datetime('now')");
  values.push(id);

  db.prepare(`UPDATE characters SET ${fields.join(', ')} WHERE id = ?`).run(...values);

  return findById(id);
}

export function deleteById(id: string): boolean {
  const db = getDb();
  const existing = findById(id);
  if (!existing) return false;

  db.prepare('DELETE FROM characters WHERE id = ?').run(id);
  return true;
}

// Relations
export function findRelations(projectId: string): CharacterRelation[] {
  const db = getDb();
  return db
    .prepare('SELECT * FROM character_relations WHERE project_id = ? ORDER BY created_at ASC')
    .all(projectId) as CharacterRelation[];
}

export function findRelationsForCharacter(characterId: string): CharacterRelation[] {
  const db = getDb();
  return db
    .prepare('SELECT * FROM character_relations WHERE character_a_id = ? OR character_b_id = ?')
    .all(characterId, characterId) as CharacterRelation[];
}

export function createRelation(data: {
  projectId: string;
  characterAId: string;
  characterBId: string;
  relationType: string;
  description?: string;
}): CharacterRelation {
  const db = getDb();
  const id = uuid();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO character_relations (id, project_id, character_a_id, character_b_id, relation_type, description, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    data.projectId,
    data.characterAId,
    data.characterBId,
    data.relationType,
    data.description ?? null,
    now,
  );

  return db.prepare('SELECT * FROM character_relations WHERE id = ?').get(id) as CharacterRelation;
}

export function deleteRelation(id: string): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM character_relations WHERE id = ?').run(id);
  return result.changes > 0;
}

const RELATION_UPDATE_FIELDS = new Set(['relation_type', 'description']);

export function updateRelation(
  id: string,
  data: Partial<{ relationType: string; description: string }>,
): CharacterRelation | undefined {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM character_relations WHERE id = ?').get(id) as CharacterRelation | undefined;
  if (!existing) return undefined;

  const fields: string[] = [];
  const values: unknown[] = [];

  const mapping: Record<string, string> = { relationType: 'relation_type' };
  for (const [key, value] of Object.entries(data)) {
    const col = mapping[key] ?? key;
    if (value !== undefined && RELATION_UPDATE_FIELDS.has(col)) {
      fields.push(`${col} = ?`);
      values.push(value);
    }
  }

  if (fields.length === 0) return existing;

  values.push(id);
  db.prepare(`UPDATE character_relations SET ${fields.join(', ')} WHERE id = ?`).run(...values);

  return db.prepare('SELECT * FROM character_relations WHERE id = ?').get(id) as CharacterRelation;
}
