import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/services/apiClient', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import { projectService } from '@/services/projectService';
import { apiClient } from '@/services/apiClient';

const mockedGet = vi.mocked(apiClient.get);
const mockedPost = vi.mocked(apiClient.post);
const mockedPut = vi.mocked(apiClient.put);
const mockedDelete = vi.mocked(apiClient.delete);

describe('projectService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('list', () => {
    it('获取所有项目列表', async () => {
      const projects = [
        { id: 'p1', name: '仙侠传说', genre: 'fantasy' },
        { id: 'p2', name: '星际冒险', genre: 'scifi' },
      ];
      mockedGet.mockResolvedValue({ success: true, data: projects, error: null });

      const result = await projectService.list();

      expect(mockedGet).toHaveBeenCalledWith('/projects');
      expect(result.data).toHaveLength(2);
      expect(result.data![0].name).toBe('仙侠传说');
    });

    it('返回空项目列表', async () => {
      mockedGet.mockResolvedValue({ success: true, data: [], error: null });

      const result = await projectService.list();

      expect(result.data).toEqual([]);
    });
  });

  describe('getById', () => {
    it('根据 ID 获取单个项目', async () => {
      const project = { id: 'p1', name: '测试项目', genre: 'fantasy', description: '描述', writingMode: 'webnovel' };
      mockedGet.mockResolvedValue({ success: true, data: project, error: null });

      const result = await projectService.getById('p1');

      expect(mockedGet).toHaveBeenCalledWith('/projects/p1');
      expect(result.data).toEqual(project);
    });
  });

  describe('create', () => {
    it('创建新项目并发送必填字段', async () => {
      const data = {
        name: '新项目',
        genre: 'fantasy',
        description: '一个新项目',
        writingMode: 'webnovel' as const,
      };
      const created = { id: 'p3', ...data };
      mockedPost.mockResolvedValue({ success: true, data: created, error: null });

      const result = await projectService.create(data);

      expect(mockedPost).toHaveBeenCalledWith('/projects', data);
      expect(result.data).toEqual(created);
    });
  });

  describe('update', () => {
    it('更新项目部分字段', async () => {
      const data = { name: '更新名称', genre: 'scifi' };
      const updated = { id: 'p1', name: '更新名称', genre: 'scifi', description: '', writingMode: 'webnovel' };
      mockedPut.mockResolvedValue({ success: true, data: updated, error: null });

      const result = await projectService.update('p1', data);

      expect(mockedPut).toHaveBeenCalledWith('/projects/p1', data);
      expect(result.data!.name).toBe('更新名称');
    });

    it('仅更新 name', async () => {
      mockedPut.mockResolvedValue({ success: true, data: { id: 'p1', name: '新名' }, error: null });

      await projectService.update('p1', { name: '新名' });

      expect(mockedPut).toHaveBeenCalledWith('/projects/p1', { name: '新名' });
    });

    it('仅更新 writingMode', async () => {
      mockedPut.mockResolvedValue({ success: true, data: { id: 'p1' }, error: null });

      await projectService.update('p1', { writingMode: 'short' });

      expect(mockedPut).toHaveBeenCalledWith('/projects/p1', { writingMode: 'short' });
    });
  });

  describe('remove', () => {
    it('删除项目', async () => {
      mockedDelete.mockResolvedValue({ success: true, data: null, error: null });

      const result = await projectService.remove('p1');

      expect(mockedDelete).toHaveBeenCalledWith('/projects/p1');
      expect(result.success).toBe(true);
    });
  });

  describe('错误处理', () => {
    it('获取不存在项目返回错误', async () => {
      mockedGet.mockResolvedValue({ success: false, data: null, error: '项目不存在' });

      const result = await projectService.getById('nonexistent');

      expect(result.success).toBe(false);
      expect(result.error).toBe('项目不存在');
    });

    it('删除失败时传递错误', async () => {
      mockedDelete.mockResolvedValue({ success: false, data: null, error: '无法删除' });

      const result = await projectService.remove('p1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('无法删除');
    });
  });
});
