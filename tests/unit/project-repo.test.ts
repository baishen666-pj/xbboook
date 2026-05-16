import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';

let memDb: Database.Database;

vi.mock('../../server/db/database.js', () => ({
  getDb: () => memDb,
}));

vi.mock('../../server/services/fileService.js', () => ({
  ensureProjectDir: vi.fn().mockResolvedValue(undefined),
  deleteProjectDir: vi.fn().mockResolvedValue(undefined),
}));

import * as projectRepo from '../../server/db/repositories/projectRepo.js';
import * as fileService from '../../server/services/fileService.js';

const mockFileService = fileService as unknown as Record<string, ReturnType<typeof vi.fn>>;

function setupTables(): void {
  memDb.exec(`
    CREATE TABLE projects (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT, genre TEXT,
      writing_style TEXT, writing_mode TEXT DEFAULT 'webnovel', target_words INTEGER,
      daily_target INTEGER DEFAULT 0, status TEXT DEFAULT 'active', sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
    );
  `);
}

describe('projectRepo', () => {
  beforeEach(() => {
    memDb = new Database(':memory:');
    memDb.pragma('foreign_keys = ON');
    setupTables();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (memDb) memDb.close();
  });

  describe('create', () => {
    it('创建项目带最少参数', async () => {
      const project = await projectRepo.create({ name: '测试小说' });

      expect(project).toBeDefined();
      expect(project.id).toBeTruthy();
      expect(project.name).toBe('测试小说');
      expect(project.writing_mode).toBe('webnovel');
      expect(project.status).toBe('active');
      expect(project.sort_order).toBe(0);
      expect(mockFileService.ensureProjectDir).toHaveBeenCalledWith(project.id);
    });

    it('创建项目带全部参数', async () => {
      const project = await projectRepo.create({
        name: '玄幻大作',
        description: '一部史诗级玄幻小说',
        genre: 'fantasy',
        writing_style: 'lyrical',
        writing_mode: 'literary',
        target_words: 200000,
      });

      expect(project.name).toBe('玄幻大作');
      expect(project.description).toBe('一部史诗级玄幻小说');
      expect(project.genre).toBe('fantasy');
      expect(project.writing_style).toBe('lyrical');
      expect(project.writing_mode).toBe('literary');
      expect(project.target_words).toBe(200000);
    });

    it('sort_order 自动递增', async () => {
      const p1 = await projectRepo.create({ name: 'First' });
      const p2 = await projectRepo.create({ name: 'Second' });
      const p3 = await projectRepo.create({ name: 'Third' });

      expect(p1.sort_order).toBe(0);
      expect(p2.sort_order).toBe(1);
      expect(p3.sort_order).toBe(2);
    });

    it('created_at 和 updated_at 自动填充', async () => {
      const project = await projectRepo.create({ name: 'DateTest' });

      expect(project.created_at).toBeTruthy();
      expect(project.updated_at).toBeTruthy();
    });
  });

  describe('findAll', () => {
    it('返回所有项目按 sort_order 升序', async () => {
      await projectRepo.create({ name: 'C' });
      await projectRepo.create({ name: 'A' });
      await projectRepo.create({ name: 'B' });

      const projects = projectRepo.findAll();

      expect(projects).toHaveLength(3);
      expect(projects[0].name).toBe('C');
      expect(projects[1].name).toBe('A');
      expect(projects[2].name).toBe('B');
    });

    it('无项目时返回空数组', () => {
      expect(projectRepo.findAll()).toEqual([]);
    });
  });

  describe('findById', () => {
    it('根据 ID 查找项目', async () => {
      const created = await projectRepo.create({ name: 'FindMe' });

      const found = projectRepo.findById(created.id);

      expect(found).toBeDefined();
      expect(found!.name).toBe('FindMe');
    });

    it('ID 不存在返回 undefined', () => {
      expect(projectRepo.findById('non-existent')).toBeUndefined();
    });
  });

  describe('update', () => {
    it('更新指定字段', async () => {
      const created = await projectRepo.create({ name: 'Original' });

      const updated = projectRepo.update(created.id, {
        name: 'Updated',
        genre: 'sci-fi',
        target_words: 100000,
      });

      expect(updated).toBeDefined();
      expect(updated!.name).toBe('Updated');
      expect(updated!.genre).toBe('sci-fi');
      expect(updated!.target_words).toBe(100000);
    });

    it('更新 updated_at 时间戳', async () => {
      const created = await projectRepo.create({ name: 'TimeTest' });
      const originalUpdatedAt = created.updated_at;

      // 等待时间流逝
      await new Promise((r) => setTimeout(r, 10));

      const updated = projectRepo.update(created.id, { name: 'TimeTest2' });

      expect(updated!.updated_at).not.toBe(originalUpdatedAt);
    });

    it('不存在的 ID 返回 undefined', () => {
      const result = projectRepo.update('non-existent', { name: 'X' });

      expect(result).toBeUndefined();
    });

    it('无有效字段时返回原记录', async () => {
      const created = await projectRepo.create({ name: 'Same' });

      const result = projectRepo.update(created.id, { unknown_field: 'ignored' } as Record<string, unknown>);

      expect(result).toBeDefined();
      expect(result!.name).toBe('Same');
    });

    it('忽略 undefined 值', async () => {
      const created = await projectRepo.create({ name: 'Alice', genre: 'fantasy' });

      const updated = projectRepo.update(created.id, { name: undefined, genre: 'sci-fi' });

      expect(updated!.name).toBe('Alice');
      expect(updated!.genre).toBe('sci-fi');
    });

    it('更新 status 字段', async () => {
      const created = await projectRepo.create({ name: 'StatusTest' });

      const updated = projectRepo.update(created.id, { status: 'completed' });

      expect(updated!.status).toBe('completed');
    });

    it('更新 sort_order 字段', async () => {
      const created = await projectRepo.create({ name: 'SortTest' });

      const updated = projectRepo.update(created.id, { sort_order: 99 });

      expect(updated!.sort_order).toBe(99);
    });
  });

  describe('deleteById', () => {
    it('删除项目并返回 true', async () => {
      const created = await projectRepo.create({ name: 'DeleteMe' });

      const result = await projectRepo.deleteById(created.id);

      expect(result).toBe(true);
      expect(projectRepo.findById(created.id)).toBeUndefined();
      expect(mockFileService.deleteProjectDir).toHaveBeenCalledWith(created.id);
    });

    it('不存在的 ID 返回 false', async () => {
      const result = await projectRepo.deleteById('non-existent');

      expect(result).toBe(false);
      expect(mockFileService.deleteProjectDir).not.toHaveBeenCalled();
    });
  });
});
