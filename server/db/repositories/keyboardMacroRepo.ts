import { getDb } from '../database.js';

export interface KeyboardMacro {
  id: string;
  projectId: string | null;
  name: string;
  description: string;
  trigger: string;
  actions: MacroAction[];
  enabled: boolean;
  scope: 'global' | 'project' | 'chapter';
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface MacroAction {
  type: 'insert' | 'replace' | 'command' | 'format';
  value: string;
  selection?: string;
}

const FIELDS = 'id, project_id, name, description, trigger, actions, enabled, scope, sort_order, created_at, updated_at';

function map(row: Record<string, unknown>): KeyboardMacro {
  return {
    id: row.id as string,
    projectId: row.project_id as string | null,
    name: row.name as string,
    description: (row.description as string) || '',
    trigger: row.trigger as string,
    actions: JSON.parse(row.actions as string || '[]'),
    enabled: !!row.enabled,
    scope: row.scope as KeyboardMacro['scope'],
    sortOrder: (row.sort_order as number) || 0,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export function findAll(projectId?: string): KeyboardMacro[] {
  const db = getDb();
  if (projectId) {
    return (db.prepare(`SELECT ${FIELDS} FROM keyboard_macros WHERE (project_id = ? OR project_id IS NULL) AND enabled = 1 ORDER BY sort_order, created_at DESC`).all(projectId) as Record<string, unknown>[]).map(map);
  }
  return (db.prepare(`SELECT ${FIELDS} FROM keyboard_macros WHERE project_id IS NULL AND enabled = 1 ORDER BY sort_order`).all() as Record<string, unknown>[]).map(map);
}

export function findById(id: string): KeyboardMacro | undefined {
  const db = getDb();
  const row = db.prepare(`SELECT ${FIELDS} FROM keyboard_macros WHERE id = ?`).get(id) as Record<string, unknown> | undefined;
  return row ? map(row) : undefined;
}

export function create(data: { id: string; projectId?: string; name: string; description?: string; trigger: string; actions: MacroAction[]; scope?: string }): KeyboardMacro {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare('INSERT INTO keyboard_macros (id, project_id, name, description, trigger, actions, enabled, scope, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?, 0, ?, ?)').run(
    data.id, data.projectId ?? null, data.name, data.description ?? '', data.trigger, JSON.stringify(data.actions), data.scope ?? 'global', now, now,
  );
  return findById(data.id)!;
}

export function update(id: string, data: Partial<Pick<KeyboardMacro, 'name' | 'description' | 'trigger' | 'actions' | 'enabled' | 'scope'>>): KeyboardMacro | undefined {
  const db = getDb();
  const sets: string[] = [];
  const values: unknown[] = [];
  if (data.name !== undefined) { sets.push('name = ?'); values.push(data.name); }
  if (data.description !== undefined) { sets.push('description = ?'); values.push(data.description); }
  if (data.trigger !== undefined) { sets.push('trigger = ?'); values.push(data.trigger); }
  if (data.actions !== undefined) { sets.push('actions = ?'); values.push(JSON.stringify(data.actions)); }
  if (data.enabled !== undefined) { sets.push('enabled = ?'); values.push(data.enabled ? 1 : 0); }
  if (data.scope !== undefined) { sets.push('scope = ?'); values.push(data.scope); }
  if (sets.length === 0) return findById(id);
  sets.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(id);
  db.prepare(`UPDATE keyboard_macros SET ${sets.join(', ')} WHERE id = ?`).run(...values);
  return findById(id);
}

export function remove(id: string): boolean {
  const db = getDb();
  return db.prepare('DELETE FROM keyboard_macros WHERE id = ?').run(id).changes > 0;
}
