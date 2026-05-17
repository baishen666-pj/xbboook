import { v4 as uuid } from 'uuid';
import { getDb } from '../database.js';

export interface StoryPlan {
  id: string;
  project_id: string;
  title: string;
  description: string;
  plan_type: 'arc' | 'volume' | 'chapter_group' | 'milestone';
  parent_id: string | null;
  start_chapter_index: number | null;
  end_chapter_index: number | null;
  target_data: string; // JSON
  status: 'planned' | 'in_progress' | 'completed' | 'abandoned';
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export function create(
  projectId: string,
  data: {
    title: string;
    description?: string;
    planType: StoryPlan['plan_type'];
    parentId?: string | null;
    startChapterIndex?: number | null;
    endChapterIndex?: number | null;
    targetData?: Record<string, unknown>;
    sortOrder?: number;
  },
): StoryPlan {
  const db = getDb();
  const id = uuid();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO story_plans (id, project_id, title, description, plan_type, parent_id, start_chapter_index, end_chapter_index, target_data, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id, projectId, data.title, data.description || '', data.planType,
    data.parentId ?? null, data.startChapterIndex ?? null, data.endChapterIndex ?? null,
    JSON.stringify(data.targetData || {}), data.sortOrder ?? 0, now, now,
  );
  return findById(id)!;
}

export function findById(id: string): StoryPlan | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM story_plans WHERE id = ?').get(id) as StoryPlan | undefined;
}

export function findByProject(projectId: string, status?: string): StoryPlan[] {
  const db = getDb();
  if (status) {
    return db.prepare(
      'SELECT * FROM story_plans WHERE project_id = ? AND status = ? ORDER BY sort_order ASC, created_at ASC',
    ).all(projectId, status) as StoryPlan[];
  }
  return db.prepare(
    'SELECT * FROM story_plans WHERE project_id = ? ORDER BY sort_order ASC, created_at ASC',
  ).all(projectId) as StoryPlan[];
}

export function findChildren(parentId: string): StoryPlan[] {
  const db = getDb();
  return db.prepare(
    'SELECT * FROM story_plans WHERE parent_id = ? ORDER BY sort_order ASC',
  ).all(parentId) as StoryPlan[];
}

export function updateStatus(id: string, status: StoryPlan['status']): void {
  const db = getDb();
  db.prepare('UPDATE story_plans SET status = ?, updated_at = ? WHERE id = ?').run(status, new Date().toISOString(), id);
}

export function updateTarget(id: string, targetData: Record<string, unknown>): void {
  const db = getDb();
  db.prepare('UPDATE story_plans SET target_data = ?, updated_at = ? WHERE id = ?').run(
    JSON.stringify(targetData), new Date().toISOString(), id,
  );
}

export function updateFields(id: string, fields: Partial<Pick<StoryPlan, 'title' | 'description' | 'start_chapter_index' | 'end_chapter_index' | 'sort_order'>>): void {
  const db = getDb();
  const sets: string[] = ['updated_at = ?'];
  const values: unknown[] = [new Date().toISOString()];

  if (fields.title !== undefined) { sets.push('title = ?'); values.push(fields.title); }
  if (fields.description !== undefined) { sets.push('description = ?'); values.push(fields.description); }
  if (fields.start_chapter_index !== undefined) { sets.push('start_chapter_index = ?'); values.push(fields.start_chapter_index); }
  if (fields.end_chapter_index !== undefined) { sets.push('end_chapter_index = ?'); values.push(fields.end_chapter_index); }
  if (fields.sort_order !== undefined) { sets.push('sort_order = ?'); values.push(fields.sort_order); }

  values.push(id);
  db.prepare(`UPDATE story_plans SET ${sets.join(', ')} WHERE id = ?`).run(...values);
}

export function deleteById(id: string): void {
  const db = getDb();
  db.prepare('DELETE FROM story_plans WHERE id = ?').run(id);
}

export function deleteByProject(projectId: string): void {
  const db = getDb();
  db.prepare('DELETE FROM story_plans WHERE project_id = ?').run(projectId);
}
