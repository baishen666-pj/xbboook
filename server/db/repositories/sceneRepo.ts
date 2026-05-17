import { v4 as uuid } from 'uuid';
import { getDb } from '../database.js';

export interface Scene {
  id: string;
  chapter_id: string;
  project_id: string;
  title: string;
  summary: string;
  content_start_offset: number;
  content_end_offset: number;
  tags: string;
  mood: string;
  location: string;
  time_of_day: string;
  pov_character_id: string | null;
  sort_order: number;
  status: 'draft' | 'writing' | 'revising' | 'done';
  word_count: number;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface SceneWithPov extends Scene {
  pov_name: string | null;
}

export function findByChapter(chapterId: string): Scene[] {
  const db = getDb();
  return db
    .prepare('SELECT * FROM scenes WHERE chapter_id = ? ORDER BY sort_order ASC, created_at ASC')
    .all(chapterId) as Scene[];
}

export function findByProject(projectId: string): Scene[] {
  const db = getDb();
  return db
    .prepare('SELECT * FROM scenes WHERE project_id = ? ORDER BY chapter_id, sort_order ASC')
    .all(projectId) as Scene[];
}

export function findById(id: string): Scene | undefined {
  const db = getDb();
  return db
    .prepare('SELECT * FROM scenes WHERE id = ?')
    .get(id) as Scene | undefined;
}

export function findByIdWithPov(id: string): SceneWithPov | undefined {
  const db = getDb();
  return db
    .prepare(`
      SELECT s.*, c.name as pov_name
      FROM scenes s
      LEFT JOIN characters c ON s.pov_character_id = c.id
      WHERE s.id = ?
    `)
    .get(id) as SceneWithPov | undefined;
}

export function findByProjectWithPov(projectId: string): SceneWithPov[] {
  const db = getDb();
  return db
    .prepare(`
      SELECT s.*, c.name as pov_name
      FROM scenes s
      LEFT JOIN characters c ON s.pov_character_id = c.id
      WHERE s.project_id = ?
      ORDER BY s.chapter_id, s.sort_order ASC
    `)
    .all(projectId) as SceneWithPov[];
}

export function create(data: {
  chapter_id: string;
  project_id: string;
  title: string;
  summary?: string;
  content_start_offset?: number;
  content_end_offset?: number;
  tags?: string;
  mood?: string;
  location?: string;
  time_of_day?: string;
  pov_character_id?: string | null;
  sort_order?: number;
  status?: 'draft' | 'writing' | 'revising' | 'done';
  word_count?: number;
  notes?: string;
}): Scene {
  const db = getDb();
  const id = uuid();

  db.prepare(`
    INSERT INTO scenes (id, chapter_id, project_id, title, summary, content_start_offset, content_end_offset,
      tags, mood, location, time_of_day, pov_character_id, sort_order, status, word_count, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, data.chapter_id, data.project_id, data.title,
    data.summary ?? '', data.content_start_offset ?? 0, data.content_end_offset ?? 0,
    data.tags ?? '[]', data.mood ?? '', data.location ?? '', data.time_of_day ?? '',
    data.pov_character_id ?? null, data.sort_order ?? 0, data.status ?? 'draft',
    data.word_count ?? 0, data.notes ?? ''
  );

  const created = findById(id);
  if (!created) throw new Error('Failed to retrieve created scene');
  return created;
}

export function update(id: string, data: {
  title?: string;
  summary?: string;
  content_start_offset?: number;
  content_end_offset?: number;
  tags?: string;
  mood?: string;
  location?: string;
  time_of_day?: string;
  pov_character_id?: string | null;
  sort_order?: number;
  status?: 'draft' | 'writing' | 'revising' | 'done';
  word_count?: number;
  notes?: string;
}): Scene | undefined {
  const db = getDb();
  const existing = findById(id);
  if (!existing) return undefined;

  const sets: string[] = [];
  const values: unknown[] = [];

  if (data.title !== undefined) { sets.push('title = ?'); values.push(data.title); }
  if (data.summary !== undefined) { sets.push('summary = ?'); values.push(data.summary); }
  if (data.content_start_offset !== undefined) { sets.push('content_start_offset = ?'); values.push(data.content_start_offset); }
  if (data.content_end_offset !== undefined) { sets.push('content_end_offset = ?'); values.push(data.content_end_offset); }
  if (data.tags !== undefined) { sets.push('tags = ?'); values.push(data.tags); }
  if (data.mood !== undefined) { sets.push('mood = ?'); values.push(data.mood); }
  if (data.location !== undefined) { sets.push('location = ?'); values.push(data.location); }
  if (data.time_of_day !== undefined) { sets.push('time_of_day = ?'); values.push(data.time_of_day); }
  if (data.pov_character_id !== undefined) { sets.push('pov_character_id = ?'); values.push(data.pov_character_id); }
  if (data.sort_order !== undefined) { sets.push('sort_order = ?'); values.push(data.sort_order); }
  if (data.status !== undefined) { sets.push('status = ?'); values.push(data.status); }
  if (data.word_count !== undefined) { sets.push('word_count = ?'); values.push(data.word_count); }
  if (data.notes !== undefined) { sets.push('notes = ?'); values.push(data.notes); }

  if (sets.length > 0) {
    sets.push("updated_at = datetime('now')");
    values.push(id);
    db.prepare(`UPDATE scenes SET ${sets.join(', ')} WHERE id = ?`).run(...values);
  }

  return findById(id);
}

export function deleteById(id: string): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM scenes WHERE id = ?').run(id);
  return result.changes > 0;
}

export function reorder(sceneIds: string[]): void {
  const db = getDb();
  const stmt = db.prepare('UPDATE scenes SET sort_order = ?, updated_at = datetime(\'now\') WHERE id = ?');
  db.transaction(() => {
    sceneIds.forEach((id, index) => {
      stmt.run(index, id);
    });
  })();
}

export function getStatsByProject(projectId: string): {
  total: number;
  byStatus: Record<string, number>;
  totalWords: number;
  byMood: Record<string, number>;
} {
  const db = getDb();
  const scenes = db
    .prepare('SELECT status, word_count, mood FROM scenes WHERE project_id = ?')
    .all(projectId) as { status: string; word_count: number; mood: string }[];

  const byStatus: Record<string, number> = {};
  const byMood: Record<string, number> = {};
  let totalWords = 0;

  for (const s of scenes) {
    byStatus[s.status] = (byStatus[s.status] ?? 0) + 1;
    totalWords += s.word_count;
    if (s.mood) {
      byMood[s.mood] = (byMood[s.mood] ?? 0) + 1;
    }
  }

  return { total: scenes.length, byStatus, totalWords, byMood };
}
