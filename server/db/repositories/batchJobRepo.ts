import { v4 as uuid } from 'uuid';
import { getDb } from '../database.js';

export interface BatchJob {
  id: string;
  project_id: string;
  plan_json: string;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  progress_json: string;
  current_chapter_index: number;
  error: string | null;
  created_at: string;
  updated_at: string;
}

export function findById(id: string): BatchJob | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM batch_jobs WHERE id = ?').get(id) as BatchJob | undefined;
}

export function findByProject(projectId: string): BatchJob[] {
  const db = getDb();
  return db
    .prepare('SELECT * FROM batch_jobs WHERE project_id = ? ORDER BY created_at DESC')
    .all(projectId) as BatchJob[];
}

export function findActiveByProject(projectId: string): BatchJob | undefined {
  const db = getDb();
  return db
    .prepare("SELECT * FROM batch_jobs WHERE project_id = ? AND status IN ('pending','running','paused') ORDER BY created_at DESC LIMIT 1")
    .get(projectId) as BatchJob | undefined;
}

export function create(data: {
  projectId: string;
  planJson: string;
  status?: BatchJob['status'];
}): BatchJob {
  const db = getDb();
  const id = uuid();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO batch_jobs (id, project_id, plan_json, status, progress_json, current_chapter_index, error, created_at, updated_at)
    VALUES (?, ?, ?, ?, '{}', 0, NULL, ?, ?)
  `).run(id, data.projectId, data.planJson, data.status ?? 'pending', now, now);

  const created = findById(id);
  if (!created) throw new Error(`Failed to retrieve created batch job: ${id}`);
  return created;
}

export function updateStatus(id: string, status: BatchJob['status'], error?: string): BatchJob | undefined {
  const db = getDb();
  const existing = findById(id);
  if (!existing) return undefined;

  if (error !== undefined) {
    db.prepare("UPDATE batch_jobs SET status = ?, error = ?, updated_at = datetime('now') WHERE id = ?")
      .run(status, error, id);
  } else {
    db.prepare("UPDATE batch_jobs SET status = ?, updated_at = datetime('now') WHERE id = ?")
      .run(status, id);
  }

  return findById(id);
}

export function updateProgress(id: string, progressJson: string, currentChapterIndex: number): BatchJob | undefined {
  const db = getDb();
  const existing = findById(id);
  if (!existing) return undefined;

  db.prepare("UPDATE batch_jobs SET progress_json = ?, current_chapter_index = ?, updated_at = datetime('now') WHERE id = ?")
    .run(progressJson, currentChapterIndex, id);

  return findById(id);
}

export function deleteById(id: string): boolean {
  const db = getDb();
  const existing = findById(id);
  if (!existing) return false;
  db.prepare('DELETE FROM batch_jobs WHERE id = ?').run(id);
  return true;
}
