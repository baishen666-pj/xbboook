import { v4 as uuid } from 'uuid';
import { getDb } from '../database.js';

export interface ChapterDependency {
  id: string;
  project_id: string;
  source_chapter_id: string;
  target_chapter_id: string;
  dependency_type: 'plot' | 'character' | 'foreshadowing' | 'timeline' | 'worldview';
  description: string;
  strength: 'weak' | 'normal' | 'strong';
  created_at: string;
}

export interface DependencyEdge extends ChapterDependency {
  source_title: string;
  target_title: string;
  source_sort_order: number;
  target_sort_order: number;
}

export function findByProject(projectId: string): DependencyEdge[] {
  const db = getDb();
  return db.prepare(`
    SELECT d.*,
      sc.title as source_title, sc.sort_order as source_sort_order,
      tc.title as target_title, tc.sort_order as target_sort_order
    FROM chapter_dependencies d
    JOIN chapters sc ON d.source_chapter_id = sc.id
    JOIN chapters tc ON d.target_chapter_id = tc.id
    WHERE d.project_id = ?
    ORDER BY sc.sort_order, tc.sort_order
  `).all(projectId) as DependencyEdge[];
}

export function findByChapter(chapterId: string): ChapterDependency[] {
  const db = getDb();
  return db.prepare(
    'SELECT * FROM chapter_dependencies WHERE source_chapter_id = ? OR target_chapter_id = ? ORDER BY created_at'
  ).all(chapterId, chapterId) as ChapterDependency[];
}

export function findById(id: string): ChapterDependency | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM chapter_dependencies WHERE id = ?').get(id) as ChapterDependency | undefined;
}

export function create(data: {
  project_id: string;
  source_chapter_id: string;
  target_chapter_id: string;
  dependency_type?: 'plot' | 'character' | 'foreshadowing' | 'timeline' | 'worldview';
  description?: string;
  strength?: 'weak' | 'normal' | 'strong';
}): ChapterDependency {
  const db = getDb();
  const id = uuid();

  db.prepare(`
    INSERT INTO chapter_dependencies (id, project_id, source_chapter_id, target_chapter_id, dependency_type, description, strength)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, data.project_id, data.source_chapter_id, data.target_chapter_id,
    data.dependency_type ?? 'plot', data.description ?? '', data.strength ?? 'normal'
  );

  const created = findById(id);
  if (!created) throw new Error('Failed to retrieve created dependency');
  return created;
}

export function update(id: string, data: {
  dependency_type?: 'plot' | 'character' | 'foreshadowing' | 'timeline' | 'worldview';
  description?: string;
  strength?: 'weak' | 'normal' | 'strong';
}): ChapterDependency | undefined {
  const db = getDb();
  const existing = findById(id);
  if (!existing) return undefined;

  const sets: string[] = [];
  const values: unknown[] = [];

  if (data.dependency_type !== undefined) { sets.push('dependency_type = ?'); values.push(data.dependency_type); }
  if (data.description !== undefined) { sets.push('description = ?'); values.push(data.description); }
  if (data.strength !== undefined) { sets.push('strength = ?'); values.push(data.strength); }

  if (sets.length > 0) {
    values.push(id);
    db.prepare(`UPDATE chapter_dependencies SET ${sets.join(', ')} WHERE id = ?`).run(...values);
  }

  return findById(id);
}

export function deleteById(id: string): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM chapter_dependencies WHERE id = ?').run(id);
  return result.changes > 0;
}

export function detectCircularDependencies(projectId: string): string[][] {
  const db = getDb();
  const deps = db.prepare(
    'SELECT source_chapter_id, target_chapter_id FROM chapter_dependencies WHERE project_id = ?'
  ).all(projectId) as { source_chapter_id: string; target_chapter_id: string }[];

  const adj = new Map<string, Set<string>>();
  for (const d of deps) {
    if (!adj.has(d.source_chapter_id)) adj.set(d.source_chapter_id, new Set());
    adj.get(d.source_chapter_id)!.add(d.target_chapter_id);
  }

  const cycles: string[][] = [];
  const visited = new Set<string>();
  const path = new Set<string>();
  const pathList: string[] = [];

  function dfs(node: string): void {
    if (path.has(node)) {
      const cycleStart = pathList.indexOf(node);
      if (cycleStart >= 0) {
        cycles.push([...pathList.slice(cycleStart), node]);
      }
      return;
    }
    if (visited.has(node)) return;

    visited.add(node);
    path.add(node);
    pathList.push(node);

    const neighbors = adj.get(node);
    if (neighbors) {
      for (const next of neighbors) {
        dfs(next);
      }
    }

    path.delete(node);
    pathList.pop();
  }

  for (const node of adj.keys()) {
    dfs(node);
  }

  return cycles;
}

export function getStats(projectId: string): {
  total: number;
  byType: Record<string, number>;
  byStrength: Record<string, number>;
  circularCount: number;
} {
  const db = getDb();
  const deps = db.prepare(
    'SELECT dependency_type, strength FROM chapter_dependencies WHERE project_id = ?'
  ).all(projectId) as { dependency_type: string; strength: string }[];

  const byType: Record<string, number> = {};
  const byStrength: Record<string, number> = {};

  for (const d of deps) {
    byType[d.dependency_type] = (byType[d.dependency_type] ?? 0) + 1;
    byStrength[d.strength] = (byStrength[d.strength] ?? 0) + 1;
  }

  const cycles = detectCircularDependencies(projectId);

  return { total: deps.length, byType, byStrength, circularCount: cycles.length };
}
