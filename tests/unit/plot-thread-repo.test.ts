import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';

let memDb: Database.Database;

vi.mock('../../server/db/database.js', () => ({
  getDb: () => memDb,
}));

import * as plotThreadRepo from '../../server/db/repositories/plotThreadRepo.js';

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
      status TEXT DEFAULT 'planned', sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
    CREATE TABLE plot_threads (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, arc_id TEXT,
      name TEXT NOT NULL, description TEXT DEFAULT '',
      status TEXT DEFAULT 'open' CHECK(status IN ('open','resolved','dormant','abandoned')),
      priority TEXT DEFAULT 'normal' CHECK(priority IN ('critical','high','normal','low')),
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (arc_id) REFERENCES story_arcs(id) ON DELETE SET NULL
    );
  `);
}

function seedProject(): string {
  const id = randomUUID();
  memDb.prepare("INSERT INTO projects (id, name) VALUES (?, 'Test Novel')").run(id);
  return id;
}

function seedArc(projectId: string): string {
  const id = randomUUID();
  memDb
    .prepare('INSERT INTO story_arcs (id, project_id, name, sort_order) VALUES (?, ?, ?, 0)')
    .run(id, projectId, 'Test Arc');
  return id;
}

describe('plotThreadRepo', () => {
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
    it('创建线索带最少参数', () => {
      const projectId = seedProject();

      const thread = plotThreadRepo.create({
        projectId,
        name: '主线情节',
      });

      expect(thread).toBeDefined();
      expect(thread.id).toBeTruthy();
      expect(thread.project_id).toBe(projectId);
      expect(thread.name).toBe('主线情节');
      expect(thread.status).toBe('open');
      expect(thread.priority).toBe('normal');
      expect(thread.arc_id).toBeNull();
      expect(thread.description).toBeNull();
      expect(thread.sort_order).toBe(0);
    });

    it('创建线索带全部参数', () => {
      const projectId = seedProject();
      const arcId = seedArc(projectId);

      const thread = plotThreadRepo.create({
        projectId,
        arcId,
        name: '复仇线',
        description: '主角复仇之路',
        status: 'resolved',
        priority: 'critical',
      });

      expect(thread.arc_id).toBe(arcId);
      expect(thread.name).toBe('复仇线');
      expect(thread.description).toBe('主角复仇之路');
      expect(thread.status).toBe('resolved');
      expect(thread.priority).toBe('critical');
    });

    it('sort_order 自动递增', () => {
      const projectId = seedProject();

      const t1 = plotThreadRepo.create({ projectId, name: 'A' });
      const t2 = plotThreadRepo.create({ projectId, name: 'B' });
      const t3 = plotThreadRepo.create({ projectId, name: 'C' });

      expect(t1.sort_order).toBe(0);
      expect(t2.sort_order).toBe(1);
      expect(t3.sort_order).toBe(2);
    });

    it('支持中文名称和描述', () => {
      const projectId = seedProject();

      const thread = plotThreadRepo.create({
        projectId,
        name: '隐藏线索：神秘人的身份',
        description: '关于神秘人真实身份的伏笔',
      });

      expect(thread.name).toBe('隐藏线索：神秘人的身份');
      expect(thread.description).toBe('关于神秘人真实身份的伏笔');
    });
  });

  describe('findByProject', () => {
    it('返回项目所有线索按 sort_order 排序', () => {
      const projectId = seedProject();

      plotThreadRepo.create({ projectId, name: 'A' });
      plotThreadRepo.create({ projectId, name: 'B' });

      const threads = plotThreadRepo.findByProject(projectId);

      expect(threads).toHaveLength(2);
      expect(threads[0].name).toBe('A');
      expect(threads[1].name).toBe('B');
    });

    it('无线索时返回空数组', () => {
      const projectId = seedProject();

      expect(plotThreadRepo.findByProject(projectId)).toEqual([]);
    });

    it('不同项目互不干扰', () => {
      const p1 = seedProject();
      const p2 = seedProject();

      plotThreadRepo.create({ projectId: p1, name: 'P1线' });
      plotThreadRepo.create({ projectId: p2, name: 'P2线A' });
      plotThreadRepo.create({ projectId: p2, name: 'P2线B' });

      expect(plotThreadRepo.findByProject(p1)).toHaveLength(1);
      expect(plotThreadRepo.findByProject(p2)).toHaveLength(2);
    });
  });

  describe('findByArc', () => {
    it('返回属于指定故事弧的所有线索', () => {
      const projectId = seedProject();
      const arcId = seedArc(projectId);

      plotThreadRepo.create({ projectId, arcId, name: 'Arc Thread 1' });
      plotThreadRepo.create({ projectId, arcId, name: 'Arc Thread 2' });
      plotThreadRepo.create({ projectId, name: 'No Arc Thread' });

      const threads = plotThreadRepo.findByArc(arcId);

      expect(threads).toHaveLength(2);
      expect(threads.every((t) => t.arc_id === arcId)).toBe(true);
    });

    it('故事弧无线索时返回空数组', () => {
      const arcId = randomUUID();

      expect(plotThreadRepo.findByArc(arcId)).toEqual([]);
    });
  });

  describe('findById', () => {
    it('根据 ID 查找线索', () => {
      const projectId = seedProject();
      const created = plotThreadRepo.create({ projectId, name: 'FindMe' });

      const found = plotThreadRepo.findById(created.id);

      expect(found).toBeDefined();
      expect(found!.name).toBe('FindMe');
    });

    it('ID 不存在返回 undefined', () => {
      expect(plotThreadRepo.findById('non-existent')).toBeUndefined();
    });
  });

  describe('update', () => {
    it('更新指定字段', () => {
      const projectId = seedProject();
      const created = plotThreadRepo.create({ projectId, name: 'Original' });

      const updated = plotThreadRepo.update(created.id, {
        name: 'Updated',
        status: 'resolved',
        priority: 'high',
      });

      expect(updated).toBeDefined();
      expect(updated!.name).toBe('Updated');
      expect(updated!.status).toBe('resolved');
      expect(updated!.priority).toBe('high');
    });

    it('更新 arc_id 为 null', () => {
      const projectId = seedProject();
      const arcId = seedArc(projectId);
      const created = plotThreadRepo.create({ projectId, arcId, name: 'T' });

      const updated = plotThreadRepo.update(created.id, { arc_id: null });

      expect(updated!.arc_id).toBeNull();
    });

    it('不存在的 ID 返回 undefined', () => {
      expect(plotThreadRepo.update('non-existent', { name: 'X' })).toBeUndefined();
    });

    it('无有效字段时返回原记录', () => {
      const projectId = seedProject();
      const created = plotThreadRepo.create({ projectId, name: 'Same' });

      const result = plotThreadRepo.update(created.id, { unknown_field: 'ignored' } as Record<string, unknown>);

      expect(result).toBeDefined();
      expect(result!.name).toBe('Same');
    });

    it('忽略 undefined 值', () => {
      const projectId = seedProject();
      const created = plotThreadRepo.create({ projectId, name: 'Alice' });

      const updated = plotThreadRepo.update(created.id, { name: undefined, status: 'dormant' });

      expect(updated!.name).toBe('Alice');
      expect(updated!.status).toBe('dormant');
    });
  });

  describe('deleteById', () => {
    it('删除线索并返回 true', () => {
      const projectId = seedProject();
      const created = plotThreadRepo.create({ projectId, name: 'DeleteMe' });

      const result = plotThreadRepo.deleteById(created.id);

      expect(result).toBe(true);
      expect(plotThreadRepo.findById(created.id)).toBeUndefined();
    });

    it('不存在的 ID 返回 false', () => {
      expect(plotThreadRepo.deleteById('non-existent')).toBe(false);
    });
  });

  describe('reorder', () => {
    it('批量更新排序顺序', () => {
      const projectId = seedProject();

      const t1 = plotThreadRepo.create({ projectId, name: 'A' });
      const t2 = plotThreadRepo.create({ projectId, name: 'B' });
      const t3 = plotThreadRepo.create({ projectId, name: 'C' });

      plotThreadRepo.reorder([
        { id: t1.id, sortOrder: 2 },
        { id: t2.id, sortOrder: 0 },
        { id: t3.id, sortOrder: 1 },
      ]);

      const threads = plotThreadRepo.findByProject(projectId);

      expect(threads[0].name).toBe('B');
      expect(threads[1].name).toBe('C');
      expect(threads[2].name).toBe('A');
    });

    it('空数组不会报错', () => {
      expect(() => plotThreadRepo.reorder([])).not.toThrow();
    });

    it('事务性更新保证原子性', () => {
      const projectId = seedProject();
      const t1 = plotThreadRepo.create({ projectId, name: 'A' });
      const t2 = plotThreadRepo.create({ projectId, name: 'B' });

      plotThreadRepo.reorder([
        { id: t1.id, sortOrder: 5 },
        { id: t2.id, sortOrder: 3 },
      ]);

      const found1 = plotThreadRepo.findById(t1.id);
      const found2 = plotThreadRepo.findById(t2.id);

      expect(found1!.sort_order).toBe(5);
      expect(found2!.sort_order).toBe(3);
    });
  });
});
