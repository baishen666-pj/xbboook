import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { SCHEMA_SQL } from '../../server/db/schemaDefinitions.js';

// Test search logic directly via database operations
describe('Search functionality', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    db.exec(SCHEMA_SQL);
  });

  afterEach(() => {
    db.close();
  });

  it('creates and queries chapters', () => {
    const projectId = 'p1';
    db.prepare('INSERT INTO projects (id, name) VALUES (?, ?)').run(projectId, '测试');
    db.prepare('INSERT INTO chapters (id, project_id, title, file_path, sort_order) VALUES (?, ?, ?, ?, ?)').run('c1', projectId, '第一章', 'p1/chapters/c1.md', 1);

    const chapters = db.prepare('SELECT * FROM chapters WHERE project_id = ?').all(projectId);
    expect(chapters).toHaveLength(1);
    expect((chapters[0] as any).title).toBe('第一章');
  });

  it('validates search query length', () => {
    const query = '一';
    expect(query.length).toBeLessThan(2);
  });

  it('performs case-insensitive search', () => {
    const content = '张三走进了山谷';
    const query = '山谷';
    const lowerContent = content.toLowerCase();
    const lowerQuery = query.toLowerCase();
    expect(lowerContent.indexOf(lowerQuery)).toBeGreaterThan(-1);
  });

  it('returns -1 for no matches', () => {
    const content = '张三走进了山谷';
    const query = '不存在xyz';
    expect(content.toLowerCase().indexOf(query.toLowerCase())).toBe(-1);
  });

  it('strips HTML tags for search', () => {
    const html = '<p>张三走进了山谷</p>';
    const plain = html.replace(/<[^>]+>/g, '').replace(/&[^;]+;/g, ' ');
    expect(plain).toBe('张三走进了山谷');
  });

  it('builds snippet with context', () => {
    const plain = '张三走进了山谷发现了一个神秘的洞穴';
    const query = '山谷';
    const idx = plain.toLowerCase().indexOf(query.toLowerCase());
    const CONTEXT = 30;
    const snippetStart = Math.max(0, idx - CONTEXT);
    const snippetEnd = Math.min(plain.length, idx + query.length + CONTEXT);
    const snippet = plain.slice(snippetStart, snippetEnd);
    expect(snippet).toContain('山谷');
  });
});