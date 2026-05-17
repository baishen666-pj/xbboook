import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/services/apiClient', () => ({
  apiClient: {
    post: vi.fn(),
  },
}));

import { searchAll, getCategoryLabel } from '@/services/searchService';
import { apiClient } from '@/services/apiClient';

const mockedPost = vi.mocked(apiClient.post);

describe('searchService', () => {
  const projectId = 'proj-1';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('searchAll', () => {
    it('returns chapter results', async () => {
      const results = [
        { category: 'chapters', chapterId: 'ch1', chapterTitle: '第一章', snippet: '张三走进了森林', matchStart: 0 },
        { category: 'chapters', chapterId: 'ch2', chapterTitle: '第二章', snippet: '在森林深处', matchStart: 1 },
      ];
      mockedPost.mockResolvedValue({ success: true, data: results, error: null });

      const result = await searchAll(projectId, '森林');

      expect(mockedPost).toHaveBeenCalledWith(`/projects/${projectId}/search`, { query: '森林' });
      expect(result).toHaveLength(2);
    });

    it('returns metadata results', async () => {
      const results = [
        { category: 'characters', id: 'c1', title: '林逸', snippet: '表面懒散' },
        { category: 'worldviews', id: 'w1', title: '灵气等级', snippet: '灵徒 → 灵师' },
      ];
      mockedPost.mockResolvedValue({ success: true, data: results, error: null });

      const result = await searchAll(projectId, '灵');

      expect(result).toHaveLength(2);
      expect(result[0].category).toBe('characters');
    });

    it('returns empty array when no matches', async () => {
      mockedPost.mockResolvedValue({ success: true, data: [], error: null });

      const result = await searchAll(projectId, '不存在的内容');

      expect(result).toEqual([]);
    });

    it('returns empty array when API returns null data', async () => {
      mockedPost.mockResolvedValue({ success: true, data: null, error: null });

      const result = await searchAll(projectId, '查询');

      expect(result).toEqual([]);
    });

    it('returns empty array on API failure', async () => {
      mockedPost.mockResolvedValue({ success: false, data: null, error: '搜索失败' });

      const result = await searchAll(projectId, '查询');

      expect(result).toEqual([]);
    });
  });

  describe('getCategoryLabel', () => {
    it('returns correct labels for all categories', () => {
      expect(getCategoryLabel('chapters')).toBe('章节');
      expect(getCategoryLabel('characters')).toBe('角色');
      expect(getCategoryLabel('worldviews')).toBe('世界观');
      expect(getCategoryLabel('outlines')).toBe('大纲');
      expect(getCategoryLabel('foreshadowing')).toBe('伏笔');
    });
  });
});
