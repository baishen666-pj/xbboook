import { v4 as uuid } from 'uuid';
import { getDb } from '../database.js';

export interface UserRow {
  id: string;
  username: string;
  display_name: string;
  avatar_color: string;
  created_at: string;
}

export function findById(id: string): UserRow | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined;
}

export function findByUsername(username: string): UserRow | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM users WHERE username = ?').get(username) as UserRow | undefined;
}

export function create(data: { username: string; displayName: string; avatarColor: string }): UserRow {
  const db = getDb();
  const id = uuid();
  db.prepare(`
    INSERT INTO users (id, username, display_name, avatar_color)
    VALUES (?, ?, ?, ?)
  `).run(id, data.username, data.displayName, data.avatarColor);
  return findById(id)!;
}

export function getAll(): UserRow[] {
  const db = getDb();
  return db.prepare('SELECT * FROM users ORDER BY created_at DESC').all() as UserRow[];
}
