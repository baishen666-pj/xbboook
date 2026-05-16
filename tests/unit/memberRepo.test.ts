import { describe, it, expect, vi, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';

let memDb: Database.Database;

vi.mock('../../server/db/database.js', () => ({
  getDb: () => memDb,
}));

import * as memberRepo from '../../server/db/repositories/memberRepo.js';

function setupTables(): void {
  memDb.exec(`
    CREATE TABLE projects (
      id TEXT PRIMARY KEY, name TEXT NOT NULL,
      status TEXT DEFAULT 'active', sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE users (
      id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL, avatar_color TEXT NOT NULL DEFAULT '#6366f1',
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE project_members (
      project_id TEXT NOT NULL, user_id TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'writer', joined_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (project_id, user_id),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);
}

function seedProject(): string {
  const id = randomUUID();
  memDb.prepare("INSERT INTO projects (id, name) VALUES (?, 'Test')").run(id);
  return id;
}

function seedUser(overrides?: { username?: string; displayName?: string }): string {
  const id = randomUUID();
  memDb.prepare('INSERT INTO users (id, username, display_name, avatar_color) VALUES (?, ?, ?, ?)').run(
    id, overrides?.username ?? 'user1', overrides?.displayName ?? 'User One', '#6366f1',
  );
  return id;
}

describe('memberRepo', () => {
  beforeEach(() => {
    memDb = new Database(':memory:');
    memDb.pragma('foreign_keys = ON');
    setupTables();
  });

  describe('addMember', () => {
    it('adds a member to a project', () => {
      const projectId = seedProject();
      const userId = seedUser();

      memberRepo.addMember(projectId, userId, 'writer');

      const role = memberRepo.getMemberRole(projectId, userId);
      expect(role).toBe('writer');
    });

    it('defaults role to writer', () => {
      const projectId = seedProject();
      const userId = seedUser();

      memberRepo.addMember(projectId, userId);

      const role = memberRepo.getMemberRole(projectId, userId);
      expect(role).toBe('writer');
    });

    it('ignores duplicate add (INSERT OR IGNORE)', () => {
      const projectId = seedProject();
      const userId = seedUser();

      memberRepo.addMember(projectId, userId, 'writer');
      // Second add should not throw
      expect(() => memberRepo.addMember(projectId, userId, 'owner')).not.toThrow();
    });
  });

  describe('removeMember', () => {
    it('removes a member from a project', () => {
      const projectId = seedProject();
      const userId = seedUser();
      memberRepo.addMember(projectId, userId);

      memberRepo.removeMember(projectId, userId);

      expect(memberRepo.isMember(projectId, userId)).toBe(false);
    });

    it('does nothing when member does not exist', () => {
      const projectId = seedProject();
      const userId = seedUser();

      expect(() => memberRepo.removeMember(projectId, userId)).not.toThrow();
    });
  });

  describe('getMemberRole', () => {
    it('returns role for existing member', () => {
      const projectId = seedProject();
      const userId = seedUser();
      memberRepo.addMember(projectId, userId, 'owner');

      const role = memberRepo.getMemberRole(projectId, userId);
      expect(role).toBe('owner');
    });

    it('returns null for non-member', () => {
      const projectId = seedProject();
      const userId = seedUser();

      const role = memberRepo.getMemberRole(projectId, userId);
      expect(role).toBeNull();
    });
  });

  describe('isMember', () => {
    it('returns true for member', () => {
      const projectId = seedProject();
      const userId = seedUser();
      memberRepo.addMember(projectId, userId);

      expect(memberRepo.isMember(projectId, userId)).toBe(true);
    });

    it('returns false for non-member', () => {
      const projectId = seedProject();
      const userId = seedUser();

      expect(memberRepo.isMember(projectId, userId)).toBe(false);
    });
  });

  describe('getMembers', () => {
    it('returns members with user details', () => {
      const projectId = seedProject();
      const userId1 = seedUser({ username: 'alice', displayName: 'Alice' });
      const userId2 = seedUser({ username: 'bob', displayName: 'Bob' });

      memberRepo.addMember(projectId, userId1, 'owner');
      memberRepo.addMember(projectId, userId2, 'writer');

      const members = memberRepo.getMembers(projectId);

      expect(members).toHaveLength(2);
      const names = members.map(m => m.display_name);
      expect(names).toContain('Alice');
      expect(names).toContain('Bob');
      const usernames = members.map(m => m.username);
      expect(usernames).toContain('alice');
    });

    it('returns empty array for project with no members', () => {
      const projectId = seedProject();
      const members = memberRepo.getMembers(projectId);
      expect(members).toHaveLength(0);
    });
  });
});
