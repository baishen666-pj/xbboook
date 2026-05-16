import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/services/apiClient', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import { worldviewService } from '@/services/worldviewService';
import { apiClient } from '@/services/apiClient';

const mockedGet = vi.mocked(apiClient.get);
const mockedPost = vi.mocked(apiClient.post);
const mockedPut = vi.mocked(apiClient.put);
const mockedDelete = vi.mocked(apiClient.delete);

describe('worldviewService', () => {
  const projectId = 'proj-1';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('list', () => {
    it('获取项目世界观列表和分类', async () => {
      const data = {
        items: [
          { id: 'w1', category: '地理', title: '大陆' },
          { id: 'w2', category: '势力', title: '门派' },
        ],
        categories: ['地理', '势力'],
      };
      mockedGet.mockResolvedValue({ success: true, data, error: null });

      const result = await worldviewService.list(projectId);

      expect(mockedGet).toHaveBeenCalledWith(`/projects/${projectId}/worldviews`);
      expect(result.data!.items).toHaveLength(2);
      expect(result.data!.categories).toEqual(['地理', '势力']);
    });

    it('返回空世界观列表', async () => {
      const data = { items: [], categories: [] };
      mockedGet.mockResolvedValue({ success: true, data, error: null });

      const result = await worldviewService.list(projectId);

      expect(result.data!.items).toEqual([]);
    });
  });

  describe('listByCategory', () => {
    it('按分类过滤世界观条目', async () => {
      const items = [{ id: 'w1', category: '地理', title: '大陆' }];
      mockedGet.mockResolvedValue({ success: true, data: items, error: null });

      const result = await worldviewService.listByCategory(projectId, '地理');

      expect(mockedGet).toHaveBeenCalledWith(
        `/projects/${projectId}/worldviews?category=${encodeURIComponent('地理')}`,
      );
      expect(result.data).toEqual(items);
    });

    it('正确编码含特殊字符的分类名', async () => {
      mockedGet.mockResolvedValue({ success: true, data: [], error: null });

      await worldviewService.listByCategory(projectId, '魔法 & 技能');

      expect(mockedGet).toHaveBeenCalledWith(
        `/projects/${projectId}/worldviews?category=${encodeURIComponent('魔法 & 技能')}`,
      );
    });
  });

  describe('getById', () => {
    it('获取单个世界观条目', async () => {
      const item = { id: 'w1', category: '地理', title: '大陆', content: '详细描述' };
      mockedGet.mockResolvedValue({ success: true, data: item, error: null });

      const result = await worldviewService.getById(projectId, 'w1');

      expect(mockedGet).toHaveBeenCalledWith(`/projects/${projectId}/worldviews/w1`);
      expect(result.data).toEqual(item);
    });
  });

  describe('create', () => {
    it('创建世界观条目并发送 category 和 title', async () => {
      const data = { category: '势力', title: '天机阁', content: '神秘组织' };
      const created = { id: 'w3', ...data };
      mockedPost.mockResolvedValue({ success: true, data: created, error: null });

      const result = await worldviewService.create(projectId, data);

      expect(mockedPost).toHaveBeenCalledWith(`/projects/${projectId}/worldviews`, data);
      expect(result.data).toEqual(created);
    });

    it('创建时 content 可选', async () => {
      const data = { category: '历史', title: '远古时代' };
      mockedPost.mockResolvedValue({ success: true, data: { id: 'w4', ...data }, error: null });

      await worldviewService.create(projectId, data);

      expect(mockedPost).toHaveBeenCalledWith(`/projects/${projectId}/worldviews`, data);
    });
  });

  describe('update', () => {
    it('更新世界观条目的部分字段', async () => {
      const data = { title: '新标题', content: '更新内容' };
      const updated = { id: 'w1', category: '地理', ...data };
      mockedPut.mockResolvedValue({ success: true, data: updated, error: null });

      const result = await worldviewService.update(projectId, 'w1', data);

      expect(mockedPut).toHaveBeenCalledWith(`/projects/${projectId}/worldviews/w1`, data);
      expect(result.data!.title).toBe('新标题');
    });

    it('仅更新 category', async () => {
      mockedPut.mockResolvedValue({ success: true, data: { id: 'w1', category: '新分类' }, error: null });

      await worldviewService.update(projectId, 'w1', { category: '新分类' });

      expect(mockedPut).toHaveBeenCalledWith(`/projects/${projectId}/worldviews/w1`, { category: '新分类' });
    });
  });

  describe('remove', () => {
    it('删除世界观条目', async () => {
      mockedDelete.mockResolvedValue({ success: true, data: null, error: null });

      const result = await worldviewService.remove(projectId, 'w1');

      expect(mockedDelete).toHaveBeenCalledWith(`/projects/${projectId}/worldviews/w1`);
      expect(result.success).toBe(true);
    });
  });

  describe('错误处理', () => {
    it('获取不存在条目返回错误', async () => {
      mockedGet.mockResolvedValue({ success: false, data: null, error: '条目不存在' });

      const result = await worldviewService.getById(projectId, 'nonexistent');

      expect(result.success).toBe(false);
      expect(result.error).toBe('条目不存在');
    });
  });
});
