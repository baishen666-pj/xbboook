import { v4 as uuid } from 'uuid';
import { getDb } from '../database.js';

export interface AgentSession {
  id: string;
  project_id: string;
  chapter_id: string | null;
  status: 'idle' | 'planning' | 'drafting' | 'reviewing' | 'revising' | 'paused' | 'completed' | 'failed';
  config: string; // JSON
  current_step: string;
  draft_content: string;
  iteration: number;
  max_iterations: number;
  plan: string;
  review_notes: string;
  final_content: string;
  created_at: string;
  updated_at: string;
}

export function create(
  projectId: string,
  chapterId: string | null,
  config: Record<string, unknown>,
  maxIterations = 3,
): AgentSession {
  const db = getDb();
  const id = uuid();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO agent_sessions (id, project_id, chapter_id, status, config, max_iterations, created_at, updated_at)
     VALUES (?, ?, ?, 'idle', ?, ?, ?, ?)`,
  ).run(id, projectId, chapterId, JSON.stringify(config), maxIterations, now, now);
  return findById(id)!;
}

export function findById(id: string): AgentSession | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM agent_sessions WHERE id = ?').get(id) as AgentSession | undefined;
}

export function findByProject(projectId: string, status?: string): AgentSession[] {
  const db = getDb();
  if (status) {
    return db.prepare(
      'SELECT * FROM agent_sessions WHERE project_id = ? AND status = ? ORDER BY created_at DESC',
    ).all(projectId, status) as AgentSession[];
  }
  return db.prepare(
    'SELECT * FROM agent_sessions WHERE project_id = ? ORDER BY created_at DESC',
  ).all(projectId) as AgentSession[];
}

export function updateStatus(
  id: string,
  status: AgentSession['status'],
  fields?: Partial<Pick<AgentSession, 'current_step' | 'draft_content' | 'iteration' | 'plan' | 'review_notes' | 'final_content'>>,
): void {
  const db = getDb();
  const now = new Date().toISOString();
  const sets: string[] = ['status = ?', 'updated_at = ?'];
  const values: unknown[] = [status, now];

  if (fields?.current_step !== undefined) { sets.push('current_step = ?'); values.push(fields.current_step); }
  if (fields?.draft_content !== undefined) { sets.push('draft_content = ?'); values.push(fields.draft_content); }
  if (fields?.iteration !== undefined) { sets.push('iteration = ?'); values.push(fields.iteration); }
  if (fields?.plan !== undefined) { sets.push('plan = ?'); values.push(fields.plan); }
  if (fields?.review_notes !== undefined) { sets.push('review_notes = ?'); values.push(fields.review_notes); }
  if (fields?.final_content !== undefined) { sets.push('final_content = ?'); values.push(fields.final_content); }

  values.push(id);
  db.prepare(`UPDATE agent_sessions SET ${sets.join(', ')} WHERE id = ?`).run(...values);
}

export function deleteById(id: string): void {
  const db = getDb();
  db.prepare('DELETE FROM agent_sessions WHERE id = ?').run(id);
}

export function deleteByProject(projectId: string): void {
  const db = getDb();
  db.prepare('DELETE FROM agent_sessions WHERE project_id = ?').run(projectId);
}
