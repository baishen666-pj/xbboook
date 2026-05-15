import { getDb } from '../database.js';

export interface MemberRow {
  project_id: string;
  user_id: string;
  role: string;
  joined_at: string;
}

export function getMembers(projectId: string): (MemberRow & { display_name: string; avatar_color: string; username: string })[] {
  const db = getDb();
  return db.prepare(`
    SELECT pm.*, u.display_name, u.avatar_color, u.username
    FROM project_members pm
    JOIN users u ON u.id = pm.user_id
    WHERE pm.project_id = ?
    ORDER BY pm.joined_at ASC
  `).all(projectId) as (MemberRow & { display_name: string; avatar_color: string; username: string })[];
}

export function addMember(projectId: string, userId: string, role = 'writer'): void {
  const db = getDb();
  db.prepare(`
    INSERT OR IGNORE INTO project_members (project_id, user_id, role)
    VALUES (?, ?, ?)
  `).run(projectId, userId, role);
}

export function removeMember(projectId: string, userId: string): void {
  const db = getDb();
  db.prepare('DELETE FROM project_members WHERE project_id = ? AND user_id = ?').run(projectId, userId);
}

export function getMemberRole(projectId: string, userId: string): string | null {
  const db = getDb();
  const row = db.prepare(
    'SELECT role FROM project_members WHERE project_id = ? AND user_id = ?'
  ).get(projectId, userId) as { role: string } | undefined;
  return row?.role ?? null;
}

export function isMember(projectId: string, userId: string): boolean {
  return getMemberRole(projectId, userId) !== null;
}
