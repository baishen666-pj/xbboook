import { v4 as uuid } from 'uuid';
import { getDb } from '../database.js';

export interface TimelineEvent {
  id: string;
  project_id: string;
  character_id: string;
  chapter_id: string | null;
  event_title: string;
  event_description: string | null;
  story_time: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

const UPDATE_FIELDS = new Set([
  'event_title', 'event_description', 'chapter_id', 'story_time', 'sort_order',
]);

export function findByCharacter(characterId: string): TimelineEvent[] {
  const db = getDb();
  return db
    .prepare('SELECT * FROM character_timelines WHERE character_id = ? ORDER BY sort_order ASC, created_at ASC')
    .all(characterId) as TimelineEvent[];
}

export function findByProject(projectId: string): TimelineEvent[] {
  const db = getDb();
  return db
    .prepare('SELECT * FROM character_timelines WHERE project_id = ? ORDER BY sort_order ASC, created_at ASC')
    .all(projectId) as TimelineEvent[];
}

export function findById(id: string): TimelineEvent | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM character_timelines WHERE id = ?').get(id) as TimelineEvent | undefined;
}

export function create(data: {
  projectId: string;
  characterId: string;
  eventTitle: string;
  chapterId?: string;
  eventDescription?: string;
  storyTime?: string;
}): TimelineEvent {
  const db = getDb();
  const id = uuid();
  const now = new Date().toISOString();

  const maxOrder = db
    .prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM character_timelines WHERE character_id = ?')
    .get(data.characterId) as { next: number };

  db.prepare(`
    INSERT INTO character_timelines (id, project_id, character_id, chapter_id, event_title, event_description, story_time, sort_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, data.projectId, data.characterId, data.chapterId ?? null,
    data.eventTitle, data.eventDescription ?? null, data.storyTime ?? null,
    maxOrder.next, now, now,
  );

  const created = findById(id);
  if (!created) throw new Error(`Failed to retrieve created timeline event: ${id}`);
  return created;
}

export function update(id: string, data: Partial<{
  event_title: string;
  event_description: string;
  chapter_id: string | null;
  story_time: string;
  sort_order: number;
}>): TimelineEvent | undefined {
  const db = getDb();
  const existing = findById(id);
  if (!existing) return undefined;

  const fields: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined && UPDATE_FIELDS.has(key)) {
      fields.push(`${key} = ?`);
      values.push(value);
    }
  }

  if (fields.length === 0) return existing;

  fields.push("updated_at = datetime('now')");
  values.push(id);

  db.prepare(`UPDATE character_timelines SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return findById(id);
}

export function deleteById(id: string): boolean {
  const db = getDb();
  const existing = findById(id);
  if (!existing) return false;
  db.prepare('DELETE FROM character_timelines WHERE id = ?').run(id);
  return true;
}
