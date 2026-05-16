import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/services/apiClient', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import { outlineService } from '@/services/outlineService';
import { apiClient } from '@/services/apiClient';

const mockedGet = vi.mocked(apiClient.get);
const mockedPost = vi.mocked(apiClient.post);
const mockedPut = vi.mocked(apiClient.put);
const mockedDelete = vi.mocked(apiClient.delete);

describe('outlineService', () => {
  const projectId = 'proj-1';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('list', () => {
    it('获取项目大纲列表', async () => {
      const outlines = [
        { id: 'o1', title: '第一幕', level: 0, content: '开端' },
        { id: 'o2', title: '第二幕', level: 0, content: '发展' },
      ];
      mockedGet.mockResolvedValue({ success: true, data: outlines, error: null });

      const result = await outlineService.list(projectId);

      expect(mockedGet).toHaveBeenCalledWith(`/projects/${projectId}/outlines`);
      expect(result.data).toHaveLength(2);
    });

    it('返回空大纲列表', async () => {
      mockedGet.mockResolvedValue({ success: true, data: [], error: null });

      const result = await outlineService.list(projectId);

      expect(result.data).toEqual([]);
    });
  });

  describe('create', () => {
    it('创建大纲条目并发送 title', async () => {
      const data = { title: '新大纲' };
      const created = { id: 'o3', ...data, level: 0, parentId: null };
      mockedPost.mockResolvedValue({ success: true, data: created, error: null });

      const result = await outlineService.create(projectId, data);

      expect(mockedPost).toHaveBeenCalledWith(`/projects/${projectId}/outlines`, data);
      expect(result.data!.title).toBe('新大纲');
    });

    it('创建带层级和父级的大纲', async () => {
      const data = { title: '子大纲', level: 1, parentId: 'o1', content: '子节点内容' };
      mockedPost.mockResolvedValue({ success: true, data: { id: 'o4', ...data }, error: null });

      await outlineService.create(projectId, data);

      expect(mockedPost).toHaveBeenCalledWith(`/projects/${projectId}/outlines`, data);
    });

    it('创建时 level、parentId、content 可选', async () => {
      const data = { title: '最简大纲' };
      mockedPost.mockResolvedValue({ success: true, data: { id: 'o5', ...data }, error: null });

      await outlineService.create(projectId, data);

      expect(mockedPost).toHaveBeenCalledWith(`/projects/${projectId}/outlines`, data);
    });
  });

  describe('update', () => {
    it('更新大纲的标题和内容', async () => {
      const data = { title: '更新标题', content: '更新内容' };
      const updated = { id: 'o1', ...data };
      mockedPut.mockResolvedValue({ success: true, data: updated, error: null });

      const result = await outlineService.update(projectId, 'o1', data);

      expect(mockedPut).toHaveBeenCalledWith(`/projects/${projectId}/outlines/o1`, data);
      expect(result.data!.title).toBe('更新标题');
    });

    it('更新大纲的层级和排序', async () => {
      const data = { level: 2, sortOrder: 5 };
      mockedPut.mockResolvedValue({ success: true, data: { id: 'o1', ...data }, error: null });

      await outlineService.update(projectId, 'o1', data);

      expect(mockedPut).toHaveBeenCalledWith(`/projects/${projectId}/outlines/o1`, data);
    });

    it('更新大纲的父级', async () => {
      const data = { parentId: 'o2' };
      mockedPut.mockResolvedValue({ success: true, data: { id: 'o1', parentId: 'o2' }, error: null });

      await outlineService.update(projectId, 'o1', data);

      expect(mockedPut).toHaveBeenCalledWith(`/projects/${projectId}/outlines/o1`, { parentId: 'o2' });
    });
  });

  describe('remove', () => {
    it('删除大纲条目', async () => {
      mockedDelete.mockResolvedValue({ success: true, data: null, error: null });

      const result = await outlineService.remove(projectId, 'o1');

      expect(mockedDelete).toHaveBeenCalledWith(`/projects/${projectId}/outlines/o1`);
      expect(result.success).toBe(true);
    });
  });

  describe('错误处理', () => {
    it('删除不存在的大纲返回错误', async () => {
      mockedDelete.mockResolvedValue({ success: false, data: null, error: '大纲不存在' });

      const result = await outlineService.remove(projectId, 'nonexistent');

      expect(result.success).toBe(false);
      expect(result.error).toBe('大纲不存在');
    });
  });
});
