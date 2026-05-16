import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/services/apiClient', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

import { snippetService } from '@/services/snippetService';
import { apiClient } from '@/services/apiClient';

const mockedGet = vi.mocked(apiClient.get);
const mockedPost = vi.mocked(apiClient.post);
const mockedPatch = vi.mocked(apiClient.patch);
const mockedDelete = vi.mocked(apiClient.delete);

describe('snippetService', () => {
  const projectId = 'proj-1';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchSnippets', () => {
    it('获取项目下所有素材片段', async () => {
      const snippets = [
        { id: 1, name: '战斗描写', category: '动作', content: '剑光闪烁' },
        { id: 2, name: '风景描写', category: '环境', content: '青山绿水' },
      ];
      mockedGet.mockResolvedValue({ success: true, data: snippets, error: null });

      const result = await snippetService.fetchSnippets(projectId);

      expect(mockedGet).toHaveBeenCalledWith(`/snippets/${projectId}`);
      expect(result.data).toHaveLength(2);
    });

    it('按分类过滤素材片段', async () => {
      const snippets = [{ id: 1, name: '战斗描写', category: '动作', content: '剑光闪烁' }];
      mockedGet.mockResolvedValue({ success: true, data: snippets, error: null });

      const result = await snippetService.fetchSnippets(projectId, '动作');

      expect(mockedGet).toHaveBeenCalledWith(`/snippets/${projectId}?category=${encodeURIComponent('动作')}`);
      expect(result.data).toHaveLength(1);
    });

    it('无 category 参数时不附加查询字符串', async () => {
      mockedGet.mockResolvedValue({ success: true, data: [], error: null });

      await snippetService.fetchSnippets(projectId);

      expect(mockedGet).toHaveBeenCalledWith(`/snippets/${projectId}`);
    });

    it('正确编码含特殊字符的分类名', async () => {
      mockedGet.mockResolvedValue({ success: true, data: [], error: null });

      await snippetService.fetchSnippets(projectId, '人物 & 性格');

      expect(mockedGet).toHaveBeenCalledWith(
        `/snippets/${projectId}?category=${encodeURIComponent('人物 & 性格')}`,
      );
    });

    it('返回空列表', async () => {
      mockedGet.mockResolvedValue({ success: true, data: [], error: null });

      const result = await snippetService.fetchSnippets(projectId);

      expect(result.data).toEqual([]);
    });
  });

  describe('createSnippet', () => {
    it('创建素材片段', async () => {
      const data = { name: '新素材', content: '素材内容' };
      const created = { id: 3, ...data, category: null };
      mockedPost.mockResolvedValue({ success: true, data: created, error: null });

      const result = await snippetService.createSnippet(projectId, data);

      expect(mockedPost).toHaveBeenCalledWith(`/snippets/${projectId}`, data);
      expect(result.data!.name).toBe('新素材');
    });

    it('创建时附带 category', async () => {
      const data = { name: '分类素材', category: '环境', content: '内容' };
      mockedPost.mockResolvedValue({ success: true, data: { id: 4, ...data }, error: null });

      await snippetService.createSnippet(projectId, data);

      expect(mockedPost).toHaveBeenCalledWith(`/snippets/${projectId}`, data);
    });
  });

  describe('updateSnippet', () => {
    it('更新素材片段的部分字段', async () => {
      const data = { name: '更新名称', content: '更新内容' };
      const updated = { id: 1, ...data, category: '动作' };
      mockedPatch.mockResolvedValue({ success: true, data: updated, error: null });

      const result = await snippetService.updateSnippet(1, data);

      expect(mockedPatch).toHaveBeenCalledWith(`/snippets/1`, data);
      expect(result.data!.name).toBe('更新名称');
    });

    it('更新素材的排序', async () => {
      const data = { sort_order: 5 };
      mockedPatch.mockResolvedValue({ success: true, data: { id: 1, sort_order: 5 }, error: null });

      await snippetService.updateSnippet(1, data);

      expect(mockedPatch).toHaveBeenCalledWith(`/snippets/1`, { sort_order: 5 });
    });

    it('更新素材的分类', async () => {
      mockedPatch.mockResolvedValue({ success: true, data: { id: 1, category: '新分类' }, error: null });

      await snippetService.updateSnippet(1, { category: '新分类' });

      expect(mockedPatch).toHaveBeenCalledWith(`/snippets/1`, { category: '新分类' });
    });
  });

  describe('deleteSnippet', () => {
    it('删除素材片段', async () => {
      mockedDelete.mockResolvedValue({ success: true, data: null, error: null });

      const result = await snippetService.deleteSnippet(1);

      expect(mockedDelete).toHaveBeenCalledWith(`/snippets/1`);
      expect(result.success).toBe(true);
    });
  });

  describe('错误处理', () => {
    it('更新不存在的素材返回错误', async () => {
      mockedPatch.mockResolvedValue({ success: false, data: null, error: '素材不存在' });

      const result = await snippetService.updateSnippet(999, { name: 'x' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('素材不存在');
    });
  });
});
