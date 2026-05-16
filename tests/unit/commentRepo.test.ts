import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';

let memDb: Database.Database;

vi.mock('../../server/db/database.js', () => ({
  getDb: () => memDb,
}));

import * as commentRepo from '../../server/db/repositories/commentRepo.js';

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
    CREATE TABLE volumes (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, title TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
    CREATE TABLE chapters (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, volume_id TEXT,
      title TEXT NOT NULL, word_count INTEGER DEFAULT 0, file_path TEXT NOT NULL,
      status TEXT DEFAULT 'draft', sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (volume_id) REFERENCES volumes(id) ON DELETE SET NULL
    );
    CREATE TABLE chapter_comments (
      id TEXT PRIMARY KEY,
      chapter_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      content TEXT NOT NULL,
      selection_from INTEGER,
      selection_to INTEGER,
      selection_text TEXT,
      resolved INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_comments_chapter ON chapter_comments(chapter_id, created_at ASC);
  `);
}

function seedProject(): string {
  const id = randomUUID();
  memDb.prepare("INSERT INTO projects (id, name) VALUES (?, 'Test Novel')").run(id);
  return id;
}

function seedUser(username = 'user1', displayName = 'User One'): string {
  const id = randomUUID();
  memDb.prepare('INSERT INTO users (id, username, display_name, avatar_color) VALUES (?, ?, ?, ?)').run(
    id, username, displayName, '#6366f1',
  );
  return id;
}

function seedChapter(projectId: string, title = 'Ch1'): string {
  const id = randomUUID();
  memDb.prepare(
    `INSERT INTO chapters (id, project_id, volume_id, title, word_count, file_path, status, sort_order)
     VALUES (?, ?, NULL, ?, 0, ?, 'draft', 0)`,
  ).run(id, projectId, title, `${projectId}/ch/${id}.md`);
  return id;
}

describe('commentRepo', () => {
  beforeEach(() => {
    memDb = new Database(':memory:');
    memDb.pragma('foreign_keys = ON');
    setupTables();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (memDb) memDb.close();
  });

  describe('create', () => {
    it('creates a comment and returns it with all fields', () => {
      const projectId = seedProject();
      const userId = seedUser();
      const chapterId = seedChapter(projectId);

      const comment = commentRepo.create({
        chapterId,
        projectId,
        userId,
        content: 'This paragraph needs work.',
      });

      expect(comment).toBeDefined();
      expect(comment.id).toBeTruthy();
      expect(comment.chapter_id).toBe(chapterId);
      expect(comment.project_id).toBe(projectId);
      expect(comment.user_id).toBe(userId);
      expect(comment.content).toBe('This paragraph needs work.');
      expect(comment.resolved).toBe(0);
      expect(comment.selection_from).toBeNull();
      expect(comment.selection_to).toBeNull();
      expect(comment.selection_text).toBeNull();
    });

    it('creates a comment with text selection', () => {
      const projectId = seedProject();
      const userId = seedUser();
      const chapterId = seedChapter(projectId);

      const comment = commentRepo.create({
        chapterId,
        projectId,
        userId,
        content: 'Typo here',
        selectionFrom: 42,
        selectionTo: 56,
        selectionText: 'teh quick fox',
      });

      expect(comment.selection_from).toBe(42);
      expect(comment.selection_to).toBe(56);
      expect(comment.selection_text).toBe('teh quick fox');
    });

    it('creates a comment with unicode and emoji content', () => {
      const projectId = seedProject();
      const userId = seedUser();
      const chapterId = seedChapter(projectId);

      const comment = commentRepo.create({
        chapterId,
        projectId,
        userId,
        content: '角色对话需要更多情感\u{1F60A} \u{4F60}\u{597D}\u{4E16}\u{754C}',
      });

      expect(comment.content).toBe('角色对话需要更多情感\u{1F60A} \u{4F60}\u{597D}\u{4E16}\u{754C}');
    });
  });

  describe('findByChapter', () => {
    it('returns comments for a chapter ordered by created_at', () => {
      const projectId = seedProject();
      const userId = seedUser();
      const chapterId = seedChapter(projectId);

      commentRepo.create({ chapterId, projectId, userId, content: 'First' });
      commentRepo.create({ chapterId, projectId, userId, content: 'Second' });

      const comments = commentRepo.findByChapter(chapterId);

      expect(comments).toHaveLength(2);
      expect(comments[0].content).toBe('First');
      expect(comments[1].content).toBe('Second');
    });

    it('returns empty array when no comments exist', () => {
      const projectId = seedProject();
      const chapterId = seedChapter(projectId);

      const comments = commentRepo.findByChapter(chapterId);

      expect(comments).toEqual([]);
    });

    it('does not return comments from other chapters', () => {
      const projectId = seedProject();
      const userId = seedUser();
      const chapter1 = seedChapter(projectId, 'Ch1');
      const chapter2 = seedChapter(projectId, 'Ch2');

      commentRepo.create({ chapterId: chapter1, projectId, userId, content: 'On chapter 1' });

      expect(commentRepo.findByChapter(chapter2)).toHaveLength(0);
      expect(commentRepo.findByChapter(chapter1)).toHaveLength(1);
    });
  });

  describe('findById', () => {
    it('returns the comment by id', () => {
      const projectId = seedProject();
      const userId = seedUser();
      const chapterId = seedChapter(projectId);

      const created = commentRepo.create({ chapterId, projectId, userId, content: 'Find me' });

      const found = commentRepo.findById(created.id);

      expect(found).toBeDefined();
      expect(found!.content).toBe('Find me');
    });

    it('returns undefined for non-existent id', () => {
      const found = commentRepo.findById('does-not-exist');

      expect(found).toBeUndefined();
    });
  });

  describe('updateContent', () => {
    it('updates the content of a comment', () => {
      const projectId = seedProject();
      const userId = seedUser();
      const chapterId = seedChapter(projectId);

      const created = commentRepo.create({ chapterId, projectId, userId, content: 'Original' });

      const updated = commentRepo.updateContent(created.id, 'Updated content');

      expect(updated).toBeDefined();
      expect(updated!.content).toBe('Updated content');
    });

    it('returns undefined for non-existent comment', () => {
      const result = commentRepo.updateContent('non-existent', 'new content');

      expect(result).toBeUndefined();
    });

    it('preserves other fields when updating content', () => {
      const projectId = seedProject();
      const userId = seedUser();
      const chapterId = seedChapter(projectId);

      const created = commentRepo.create({
        chapterId, projectId, userId,
        content: 'Original',
        selectionFrom: 10, selectionTo: 20, selectionText: 'some text',
      });

      const updated = commentRepo.updateContent(created.id, 'Changed');

      expect(updated!.selection_from).toBe(10);
      expect(updated!.selection_to).toBe(20);
      expect(updated!.selection_text).toBe('some text');
    });
  });

  describe('resolve', () => {
    it('marks a comment as resolved', () => {
      const projectId = seedProject();
      const userId = seedUser();
      const chapterId = seedChapter(projectId);

      const created = commentRepo.create({ chapterId, projectId, userId, content: 'To resolve' });

      const resolved = commentRepo.resolve(created.id);

      expect(resolved).toBeDefined();
      expect(resolved!.resolved).toBe(1);
    });

    it('returns undefined for non-existent comment', () => {
      const result = commentRepo.resolve('non-existent');

      expect(result).toBeUndefined();
    });

    it('does not affect other comments', () => {
      const projectId = seedProject();
      const userId = seedUser();
      const chapterId = seedChapter(projectId);

      const c1 = commentRepo.create({ chapterId, projectId, userId, content: 'A' });
      const c2 = commentRepo.create({ chapterId, projectId, userId, content: 'B' });

      commentRepo.resolve(c1.id);

      expect(commentRepo.findById(c2.id)!.resolved).toBe(0);
    });
  });

  describe('remove', () => {
    it('deletes a comment and returns true', () => {
      const projectId = seedProject();
      const userId = seedUser();
      const chapterId = seedChapter(projectId);

      const created = commentRepo.create({ chapterId, projectId, userId, content: 'Delete me' });

      const result = commentRepo.remove(created.id);

      expect(result).toBe(true);
      expect(commentRepo.findById(created.id)).toBeUndefined();
    });

    it('returns false for non-existent comment', () => {
      const result = commentRepo.remove('non-existent');

      expect(result).toBe(false);
    });

    it('removes only the target comment', () => {
      const projectId = seedProject();
      const userId = seedUser();
      const chapterId = seedChapter(projectId);

      const c1 = commentRepo.create({ chapterId, projectId, userId, content: 'Keep' });
      const c2 = commentRepo.create({ chapterId, projectId, userId, content: 'Remove' });

      commentRepo.remove(c2.id);

      expect(commentRepo.findByChapter(chapterId)).toHaveLength(1);
      expect(commentRepo.findById(c1.id)).toBeDefined();
    });
  });
});
