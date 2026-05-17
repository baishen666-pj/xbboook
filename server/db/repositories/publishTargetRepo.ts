import { v4 as uuid } from 'uuid';
import { getDb } from '../database.js';

export interface PublishTarget {
  id: string;
  project_id: string;
  name: string;
  platform: string;
  config: string;
  last_published_at: string | null;
  created_at: string;
  updated_at: string;
}

export function findByProject(projectId: string): PublishTarget[] {
  const db = getDb();
  return db.prepare(
    'SELECT * FROM publish_targets WHERE project_id = ? ORDER BY created_at ASC',
  ).all(projectId) as PublishTarget[];
}

export function findById(id: string): PublishTarget | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM publish_targets WHERE id = ?').get(id) as PublishTarget | undefined;
}

export function create(data: {
  projectId: string;
  name: string;
  platform: string;
  config: string;
}): PublishTarget {
  const db = getDb();
  const id = uuid();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO publish_targets (id, project_id, name, platform, config, last_published_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, NULL, ?, ?)
  `).run(id, data.projectId, data.name, data.platform, data.config, now, now);

  const created = findById(id);
  if (!created) throw new Error(`Failed to create publish target: ${id}`);
  return created;
}

export function update(id: string, data: Partial<{
  name: string;
  platform: string;
  config: string;
  last_published_at: string;
}>): PublishTarget | undefined {
  const db = getDb();
  const existing = findById(id);
  if (!existing) return undefined;

  const fields: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      fields.push(`${key} = ?`);
      values.push(value);
    }
  }

  if (fields.length === 0) return existing;

  fields.push("updated_at = datetime('now')");
  values.push(id);
  db.prepare(`UPDATE publish_targets SET ${fields.join(', ')} WHERE id = ?`).run(...values);

  return findById(id);
}

export function deleteById(id: string): boolean {
  const db = getDb();
  const existing = findById(id);
  if (!existing) return false;
  db.prepare('DELETE FROM publish_targets WHERE id = ?').run(id);
  return true;
}

export function updateLastPublished(id: string): void {
  const db = getDb();
  db.prepare("UPDATE publish_targets SET last_published_at = datetime('now'), updated_at = datetime('now') WHERE id = ?").run(id);
}
