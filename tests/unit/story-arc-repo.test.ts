import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';

let memDb: Database.Database;

vi.mock('../../server/db/database.js', () => ({
  getDb: () => memDb,
}));

import * as storyArcRepo from '../../server/db/repositories/storyArcRepo.js';

function setupTables(): void {
  memDb.exec(`
    CREATE TABLE projects (
      id TEXT PRIMARY KEY, name TEXT NOT NULL,
      status TEXT DEFAULT 'active', sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE story_arcs (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, name TEXT NOT NULL,
      description TEXT DEFAULT '', start_chapter INTEGER, end_chapter INTEGER,
      status TEXT DEFAULT 'planned' CHECK(status IN ('planned','active','completed','abandoned')),
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
  `);
}

function seedProject(): string {
  const id = randomUUID();
  memDb.prepare("INSERT INTO projects (id, name) VALUES (?, 'Test Novel')").run(id);
  return id;
}

describe('storyArcRepo', () => {
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
    it('创建故事弧带最少参数', () => {
      const projectId = seedProject();

      const arc = storyArcRepo.create({ projectId, name: '第一卷' });

      expect(arc).toBeDefined();
      expect(arc.id).toBeTruthy();
      expect(arc.project_id).toBe(projectId);
      expect(arc.name).toBe('第一卷');
      expect(arc.status).toBe('planned');
      expect(arc.description).toBeNull();
      expect(arc.start_chapter).toBeNull();
      expect(arc.end_chapter).toBeNull();
      expect(arc.sort_order).toBe(0);
    });

    it('创建故事弧带全部参数', () => {
      const projectId = seedProject();

      const arc = storyArcRepo.create({
        projectId,
        name: '暗影之战',
        description: '主角对抗暗影势力的故事线',
        startChapter: 1,
        endChapter: 30,
        status: 'active',
      });

      expect(arc.name).toBe('暗影之战');
      expect(arc.description).toBe('主角对抗暗影势力的故事线');
      expect(arc.start_chapter).toBe(1);
      expect(arc.end_chapter).toBe(30);
      expect(arc.status).toBe('active');
    });

    it('sort_order 自动递增', () => {
      const projectId = seedProject();

      const a1 = storyArcRepo.create({ projectId, name: 'A' });
      const a2 = storyArcRepo.create({ projectId, name: 'B' });
      const a3 = storyArcRepo.create({ projectId, name: 'C' });

      expect(a1.sort_order).toBe(0);
      expect(a2.sort_order).toBe(1);
      expect(a3.sort_order).toBe(2);
    });

    it('created_at 和 updated_at 自动填充', () => {
      const projectId = seedProject();

      const arc = storyArcRepo.create({ projectId, name: 'TimeTest' });

      expect(arc.created_at).toBeTruthy();
      expect(arc.updated_at).toBeTruthy();
    });
  });

  describe('findByProject', () => {
    it('返回项目所有故事弧按 sort_order 排序', () => {
      const projectId = seedProject();

      storyArcRepo.create({ projectId, name: 'Arc1' });
      storyArcRepo.create({ projectId, name: 'Arc2' });

      const arcs = storyArcRepo.findByProject(projectId);

      expect(arcs).toHaveLength(2);
      expect(arcs[0].name).toBe('Arc1');
      expect(arcs[1].name).toBe('Arc2');
    });

    it('无故事弧时返回空数组', () => {
      const projectId = seedProject();

      expect(storyArcRepo.findByProject(projectId)).toEqual([]);
    });

    it('不同项目互不干扰', () => {
      const p1 = seedProject();
      const p2 = seedProject();

      storyArcRepo.create({ projectId: p1, name: 'P1 Arc' });
      storyArcRepo.create({ projectId: p2, name: 'P2 Arc1' });
      storyArcRepo.create({ projectId: p2, name: 'P2 Arc2' });

      expect(storyArcRepo.findByProject(p1)).toHaveLength(1);
      expect(storyArcRepo.findByProject(p2)).toHaveLength(2);
    });
  });

  describe('findById', () => {
    it('根据 ID 查找故事弧', () => {
      const projectId = seedProject();
      const created = storyArcRepo.create({ projectId, name: 'FindMe' });

      const found = storyArcRepo.findById(created.id);

      expect(found).toBeDefined();
      expect(found!.name).toBe('FindMe');
    });

    it('ID 不存在返回 undefined', () => {
      expect(storyArcRepo.findById('non-existent')).toBeUndefined();
    });
  });

  describe('update', () => {
    it('更新指定字段', () => {
      const projectId = seedProject();
      const created = storyArcRepo.create({ projectId, name: 'Original' });

      const updated = storyArcRepo.update(created.id, {
        name: 'Updated',
        description: 'Updated description',
        status: 'completed',
      });

      expect(updated).toBeDefined();
      expect(updated!.name).toBe('Updated');
      expect(updated!.description).toBe('Updated description');
      expect(updated!.status).toBe('completed');
    });

    it('更新章节范围', () => {
      const projectId = seedProject();
      const created = storyArcRepo.create({ projectId, name: 'Arc' });

      const updated = storyArcRepo.update(created.id, {
        start_chapter: 5,
        end_chapter: 20,
      });

      expect(updated!.start_chapter).toBe(5);
      expect(updated!.end_chapter).toBe(20);
    });

    it('将章节范围设为 null', () => {
      const projectId = seedProject();
      const created = storyArcRepo.create({ projectId, name: 'Arc', startChapter: 1, endChapter: 10 });

      const updated = storyArcRepo.update(created.id, {
        start_chapter: null,
        end_chapter: null,
      });

      expect(updated!.start_chapter).toBeNull();
      expect(updated!.end_chapter).toBeNull();
    });

    it('不存在的 ID 返回 undefined', () => {
      expect(storyArcRepo.update('non-existent', { name: 'X' })).toBeUndefined();
    });

    it('无有效字段时返回原记录', () => {
      const projectId = seedProject();
      const created = storyArcRepo.create({ projectId, name: 'Same' });

      const result = storyArcRepo.update(created.id, { unknown_field: 'ignored' } as Record<string, unknown>);

      expect(result).toBeDefined();
      expect(result!.name).toBe('Same');
    });

    it('忽略 undefined 值', () => {
      const projectId = seedProject();
      const created = storyArcRepo.create({ projectId, name: 'Alice', status: 'planned' });

      const updated = storyArcRepo.update(created.id, { name: undefined, status: 'active' });

      expect(updated!.name).toBe('Alice');
      expect(updated!.status).toBe('active');
    });

    it('更新 sort_order', () => {
      const projectId = seedProject();
      const created = storyArcRepo.create({ projectId, name: 'Arc' });

      const updated = storyArcRepo.update(created.id, { sort_order: 42 });

      expect(updated!.sort_order).toBe(42);
    });
  });

  describe('deleteById', () => {
    it('删除故事弧并返回 true', () => {
      const projectId = seedProject();
      const created = storyArcRepo.create({ projectId, name: 'DeleteMe' });

      const result = storyArcRepo.deleteById(created.id);

      expect(result).toBe(true);
      expect(storyArcRepo.findById(created.id)).toBeUndefined();
    });

    it('不存在的 ID 返回 false', () => {
      expect(storyArcRepo.deleteById('non-existent')).toBe(false);
    });
  });

  describe('reorder', () => {
    it('批量更新排序顺序', () => {
      const projectId = seedProject();

      const a1 = storyArcRepo.create({ projectId, name: 'A' });
      const a2 = storyArcRepo.create({ projectId, name: 'B' });
      const a3 = storyArcRepo.create({ projectId, name: 'C' });

      storyArcRepo.reorder([
        { id: a1.id, sortOrder: 2 },
        { id: a2.id, sortOrder: 0 },
        { id: a3.id, sortOrder: 1 },
      ]);

      const arcs = storyArcRepo.findByProject(projectId);

      expect(arcs[0].name).toBe('B');
      expect(arcs[1].name).toBe('C');
      expect(arcs[2].name).toBe('A');
    });

    it('空数组不会报错', () => {
      expect(() => storyArcRepo.reorder([])).not.toThrow();
    });

    it('事务性更新保证原子性', () => {
      const projectId = seedProject();
      const a1 = storyArcRepo.create({ projectId, name: 'A' });
      const a2 = storyArcRepo.create({ projectId, name: 'B' });

      storyArcRepo.reorder([
        { id: a1.id, sortOrder: 10 },
        { id: a2.id, sortOrder: 5 },
      ]);

      const found1 = storyArcRepo.findById(a1.id);
      const found2 = storyArcRepo.findById(a2.id);

      expect(found1!.sort_order).toBe(10);
      expect(found2!.sort_order).toBe(5);
    });
  });
});
