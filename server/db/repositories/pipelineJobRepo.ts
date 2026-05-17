import { v4 as uuid } from 'uuid';
import { getDb } from '../database.js';

export interface PipelineJobRow {
  id: string;
  project_id: string;
  chapter_ids: string;
  current_step: number;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed';
  error: string | null;
  created_at: string;
  updated_at: string;
}

export function create(data: {
  projectId: string;
  chapterIds: string[];
}): PipelineJobRow {
  const db = getDb();
  const id = uuid();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO pipeline_jobs (id, project_id, chapter_ids, current_step, status, created_at, updated_at)
    VALUES (?, ?, ?, 0, 'pending', ?, ?)
  `).run(id, data.projectId, JSON.stringify(data.chapterIds), now, now);
  return findById(id)!;
}

export function findById(id: string): PipelineJobRow | undefined {
  return getDb().prepare('SELECT * FROM pipeline_jobs WHERE id = ?').get(id) as PipelineJobRow | undefined;
}

export function findByProject(projectId: string): PipelineJobRow[] {
  return getDb().prepare(
    'SELECT * FROM pipeline_jobs WHERE project_id = ? ORDER BY created_at DESC',
  ).all(projectId) as PipelineJobRow[];
}

export function findRunning(): PipelineJobRow[] {
  return getDb().prepare(
    "SELECT * FROM pipeline_jobs WHERE status = 'running'",
  ).all() as PipelineJobRow[];
}

export function updateStatus(
  id: string,
  status: string,
  currentStep?: number,
  error?: string,
): PipelineJobRow | undefined {
  const db = getDb();
  const now = new Date().toISOString();
  if (currentStep !== undefined && error !== undefined) {
    db.prepare("UPDATE pipeline_jobs SET status = ?, current_step = ?, error = ?, updated_at = ? WHERE id = ?")
      .run(status, currentStep, error, now, id);
  } else if (currentStep !== undefined) {
    db.prepare("UPDATE pipeline_jobs SET status = ?, current_step = ?, updated_at = ? WHERE id = ?")
      .run(status, currentStep, now, id);
  } else if (error !== undefined) {
    db.prepare("UPDATE pipeline_jobs SET status = ?, error = ?, updated_at = ? WHERE id = ?")
      .run(status, error, now, id);
  } else {
    db.prepare("UPDATE pipeline_jobs SET status = ?, updated_at = ? WHERE id = ?")
      .run(status, now, id);
  }
  return findById(id);
}

export function deleteById(id: string): boolean {
  const result = getDb().prepare('DELETE FROM pipeline_jobs WHERE id = ?').run(id);
  return result.changes > 0;
}

export function deleteOldJobs(): number {
  const db = getDb();
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const result = db.prepare(
    "DELETE FROM pipeline_jobs WHERE status IN ('completed','failed') AND updated_at < ?",
  ).run(cutoff);
  return result.changes;
}
