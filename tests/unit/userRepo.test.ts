import { describe, it, expect, vi, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';

let memDb: Database.Database;

vi.mock('../../server/db/database.js', () => ({
  getDb: () => memDb,
}));

import * as userRepo from '../../server/db/repositories/userRepo.js';

function setupTables(): void {
  memDb.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      avatar_color TEXT NOT NULL DEFAULT '#6366f1',
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
}

function seedUser(overrides?: { username?: string; displayName?: string; avatarColor?: string }): string {
  const id = randomUUID();
  memDb.prepare('INSERT INTO users (id, username, display_name, avatar_color) VALUES (?, ?, ?, ?)').run(
    id,
    overrides?.username ?? 'testuser',
    overrides?.displayName ?? 'Test User',
    overrides?.avatarColor ?? '#6366f1',
  );
  return id;
}

describe('userRepo', () => {
  beforeEach(() => {
    memDb = new Database(':memory:');
    setupTables();
  });

  describe('create', () => {
    it('creates a user and returns it', () => {
      const user = userRepo.create({ username: 'alice', displayName: 'Alice', avatarColor: '#ec4899' });

      expect(user).toBeDefined();
      expect(user.id).toBeDefined();
      expect(user.username).toBe('alice');
      expect(user.display_name).toBe('Alice');
      expect(user.avatar_color).toBe('#ec4899');
    });

    it('throws on duplicate username', () => {
      userRepo.create({ username: 'unique', displayName: 'First', avatarColor: '#000000' });

      expect(() => {
        userRepo.create({ username: 'unique', displayName: 'Second', avatarColor: '#000000' });
      }).toThrow();
    });
  });

  describe('findById', () => {
    it('returns user when found', () => {
      const id = seedUser({ username: 'bob' });

      const user = userRepo.findById(id);

      expect(user).toBeDefined();
      expect(user!.id).toBe(id);
      expect(user!.username).toBe('bob');
    });

    it('returns undefined when not found', () => {
      const user = userRepo.findById('nonexistent');
      expect(user).toBeUndefined();
    });
  });

  describe('findByUsername', () => {
    it('returns user by username', () => {
      seedUser({ username: 'charlie', displayName: 'Charlie' });

      const user = userRepo.findByUsername('charlie');

      expect(user).toBeDefined();
      expect(user!.display_name).toBe('Charlie');
    });

    it('returns undefined for unknown username', () => {
      const user = userRepo.findByUsername('unknown');
      expect(user).toBeUndefined();
    });
  });

  describe('getAll', () => {
    it('returns all users ordered by created_at descending', () => {
      seedUser({ username: 'user1' });
      seedUser({ username: 'user2' });
      seedUser({ username: 'user3' });

      const users = userRepo.getAll();

      expect(users).toHaveLength(3);
    });

    it('returns empty array when no users', () => {
      const users = userRepo.getAll();
      expect(users).toHaveLength(0);
    });
  });
});
