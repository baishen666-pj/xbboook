import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/services/apiClient', () => ({
  apiClient: {
    post: vi.fn(),
  },
}));

import { searchChapters } from '@/services/searchService';
import { apiClient } from '@/services/apiClient';

const mockedPost = vi.mocked(apiClient.post);

describe('searchService', () => {
  const projectId = 'proj-1';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('searchChapters', () => {
    it('发送搜索请求并返回匹配结果', async () => {
      const results = [
        { chapterId: 'ch1', chapterTitle: '第一章', snippet: '张三走进了森林', matchStart: 0 },
        { chapterId: 'ch2', chapterTitle: '第二章', snippet: '在森林深处', matchStart: 1 },
      ];
      mockedPost.mockResolvedValue({ success: true, data: results, error: null });

      const result = await searchChapters(projectId, '森林');

      expect(mockedPost).toHaveBeenCalledWith(`/projects/${projectId}/search`, { query: '森林' });
      expect(result).toHaveLength(2);
      expect(result[0].chapterId).toBe('ch1');
    });

    it('无匹配结果时返回空数组', async () => {
      mockedPost.mockResolvedValue({ success: true, data: [], error: null });

      const result = await searchChapters(projectId, '不存在的内容');

      expect(result).toEqual([]);
    });

    it('API 返回 null data 时返回空数组', async () => {
      mockedPost.mockResolvedValue({ success: true, data: null, error: null });

      const result = await searchChapters(projectId, '查询');

      expect(result).toEqual([]);
    });

    it('API 返回失败时返回空数组', async () => {
      mockedPost.mockResolvedValue({ success: false, data: null, error: '搜索失败' });

      const result = await searchChapters(projectId, '查询');

      expect(result).toEqual([]);
    });

    it('正确传递中文查询', async () => {
      mockedPost.mockResolvedValue({ success: true, data: [], error: null });

      await searchChapters(projectId, '主角修炼功法');

      expect(mockedPost).toHaveBeenCalledWith(`/projects/${projectId}/search`, {
        query: '主角修炼功法',
      });
    });

    it('正确传递特殊字符查询', async () => {
      mockedPost.mockResolvedValue({ success: true, data: [], error: null });

      await searchChapters(projectId, 'test "引号" & <标签>');

      expect(mockedPost).toHaveBeenCalledWith(`/projects/${projectId}/search`, {
        query: 'test "引号" & <标签>',
      });
    });

    it('空查询字符串也能发送', async () => {
      mockedPost.mockResolvedValue({ success: true, data: [], error: null });

      const result = await searchChapters(projectId, '');

      expect(mockedPost).toHaveBeenCalledWith(`/projects/${projectId}/search`, { query: '' });
      expect(result).toEqual([]);
    });
  });
});
