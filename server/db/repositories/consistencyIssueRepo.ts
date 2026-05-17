import { getDb } from '../database.js';
import { logger } from '../../middleware/logger.js';
import type { ConsistencyIssue } from '../../types/index.js';

const ISSUE_FIELDS = 'id, project_id, chapter_id, type, severity, title, description, suggestion, status, source, created_at, updated_at';

function mapToCamel(row: Record<string, unknown>): ConsistencyIssue {
  return {
    id: row.id as string,
    projectId: row.project_id as string,
    chapterId: row.chapter_id as string | null,
    type: row.type as ConsistencyIssue['type'],
    severity: row.severity as ConsistencyIssue['severity'],
    title: row.title as string,
    description: row.description as string,
    suggestion: row.suggestion as string,
    status: row.status as ConsistencyIssue['status'],
    source: row.source as ConsistencyIssue['source'],
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export function findByProject(projectId: string, status?: string): ConsistencyIssue[] {
  const db = getDb();
  if (status) {
    return (db.prepare(`SELECT ${ISSUE_FIELDS} FROM consistency_issues WHERE project_id = ? AND status = ? ORDER BY created_at DESC`).all(projectId, status) as Record<string, unknown>[]).map(mapToCamel);
  }
  return (db.prepare(`SELECT ${ISSUE_FIELDS} FROM consistency_issues WHERE project_id = ? ORDER BY created_at DESC`).all(projectId) as Record<string, unknown>[]).map(mapToCamel);
}

export function findById(id: string): ConsistencyIssue | undefined {
  const db = getDb();
  const row = db.prepare(`SELECT ${ISSUE_FIELDS} FROM consistency_issues WHERE id = ?`).get(id) as Record<string, unknown> | undefined;
  return row ? mapToCamel(row) : undefined;
}

interface CreateData {
  id: string;
  projectId: string;
  chapterId?: string | null;
  type: string;
  severity?: string;
  title: string;
  description?: string;
  suggestion?: string;
  status?: string;
  source?: string;
}

export function create(data: CreateData): ConsistencyIssue {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO consistency_issues (id, project_id, chapter_id, type, severity, title, description, suggestion, status, source, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    data.id, data.projectId, data.chapterId ?? null, data.type, data.severity ?? 'medium', data.title, data.description ?? '', data.suggestion ?? '', data.status ?? 'open', data.source ?? 'ai', now, now,
  );
  return findById(data.id)!;
}

interface UpdateData {
  status?: string;
  severity?: string;
  title?: string;
  description?: string;
  suggestion?: string;
}

export function update(id: string, data: UpdateData): ConsistencyIssue | undefined {
  const db = getDb();
  const sets: string[] = [];
  const values: unknown[] = [];
  if (data.status !== undefined) { sets.push('status = ?'); values.push(data.status); }
  if (data.severity !== undefined) { sets.push('severity = ?'); values.push(data.severity); }
  if (data.title !== undefined) { sets.push('title = ?'); values.push(data.title); }
  if (data.description !== undefined) { sets.push('description = ?'); values.push(data.description); }
  if (data.suggestion !== undefined) { sets.push('suggestion = ?'); values.push(data.suggestion); }
  if (sets.length === 0) return findById(id);
  sets.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(id);
  db.prepare(`UPDATE consistency_issues SET ${sets.join(', ')} WHERE id = ?`).run(...values);
  return findById(id);
}

export function remove(id: string): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM consistency_issues WHERE id = ?').run(id);
  return result.changes > 0;
}

export function countByStatus(projectId: string): Record<string, number> {
  const db = getDb();
  const rows = db.prepare('SELECT status, COUNT(*) as count FROM consistency_issues WHERE project_id = ? GROUP BY status').all(projectId) as { status: string; count: number }[];
  const result: Record<string, number> = { open: 0, acknowledged: 0, fixed: 0, dismissed: 0 };
  for (const row of rows) {
    result[row.status] = row.count;
  }
  return result;
}

interface BulkIssue {
  chapterId?: string | null;
  type: string;
  severity?: string;
  title: string;
  description?: string;
  suggestion?: string;
}

export function bulkCreate(projectId: string, issues: BulkIssue[]): number {
  const db = getDb();
  const now = new Date().toISOString();
  const stmt = db.prepare(`INSERT INTO consistency_issues (id, project_id, chapter_id, type, severity, title, description, suggestion, status, source, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', 'ai', ?, ?)`);
  const insertMany = db.transaction((items: BulkIssue[]) => {
    let count = 0;
    for (const item of items) {
      const id = crypto.randomUUID();
      stmt.run(id, projectId, item.chapterId ?? null, item.type, item.severity ?? 'medium', item.title, item.description ?? '', item.suggestion ?? '', now, now);
      count++;
    }
    return count;
  });
  const count = insertMany(issues);
  logger.info({ projectId, count }, 'Bulk created consistency issues');
  return count;
}
