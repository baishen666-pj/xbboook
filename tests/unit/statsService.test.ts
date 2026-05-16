import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/services/apiClient', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

import { statsService } from '@/services/statsService';
import { apiClient } from '@/services/apiClient';

const mockedGet = vi.mocked(apiClient.get);
const mockedPost = vi.mocked(apiClient.post);

describe('statsService', () => {
  const projectId = 'proj-1';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getStats', () => {
    it('获取项目统计数据包含摘要和近期数据', async () => {
      const data = {
        summary: { totalWords: 50000, totalDays: 30, avgDaily: 1666, bestDayWords: 5000 },
        recent: [
          { date: '2026-05-16', wordsAdded: 2000, wordsTotal: 50000 },
          { date: '2026-05-15', wordsAdded: 1500, wordsTotal: 48000 },
        ],
      };
      mockedGet.mockResolvedValue({ success: true, data, error: null });

      const result = await statsService.getStats(projectId);

      expect(mockedGet).toHaveBeenCalledWith(`/projects/${projectId}/stats`);
      expect(result.data!.summary.totalWords).toBe(50000);
      expect(result.data!.recent).toHaveLength(2);
    });

    it('统计数据近期记录为空', async () => {
      const data = {
        summary: { totalWords: 0, totalDays: 0, avgDaily: 0, bestDayWords: 0 },
        recent: [],
      };
      mockedGet.mockResolvedValue({ success: true, data, error: null });

      const result = await statsService.getStats(projectId);

      expect(result.data!.recent).toEqual([]);
    });
  });

  describe('record', () => {
    it('记录每日写作数据', async () => {
      const data = {
        date: '2026-05-17',
        wordsAdded: 3000,
        wordsTotal: 53000,
      };
      const recorded = { id: 'ds1', projectId, ...data, writingTimeMs: 0, chaptersWorked: 0 };
      mockedPost.mockResolvedValue({ success: true, data: recorded, error: null });

      const result = await statsService.record(projectId, data);

      expect(mockedPost).toHaveBeenCalledWith(`/projects/${projectId}/stats`, data);
      expect(result.data!.wordsAdded).toBe(3000);
    });

    it('记录包含写作时间和章节数', async () => {
      const data = {
        date: '2026-05-17',
        wordsAdded: 2000,
        wordsTotal: 52000,
        writingTimeMs: 3600000,
        chaptersWorked: 3,
      };
      mockedPost.mockResolvedValue({ success: true, data: { id: 'ds2', ...data }, error: null });

      const result = await statsService.record(projectId, data);

      expect(mockedPost).toHaveBeenCalledWith(`/projects/${projectId}/stats`, data);
      expect(result.data!.writingTimeMs).toBe(3600000);
      expect(result.data!.chaptersWorked).toBe(3);
    });

    it('writingTimeMs 和 chaptersWorked 可选', async () => {
      const data = {
        date: '2026-05-17',
        wordsAdded: 1000,
        wordsTotal: 51000,
      };
      mockedPost.mockResolvedValue({ success: true, data: { id: 'ds3', ...data }, error: null });

      await statsService.record(projectId, data);

      const callData = mockedPost.mock.calls[0][1] as Record<string, unknown>;
      expect(callData.writingTimeMs).toBeUndefined();
      expect(callData.chaptersWorked).toBeUndefined();
    });
  });

  describe('错误处理', () => {
    it('获取统计失败时传递错误', async () => {
      mockedGet.mockResolvedValue({ success: false, data: null, error: '项目不存在' });

      const result = await statsService.getStats('nonexistent');

      expect(result.success).toBe(false);
      expect(result.error).toBe('项目不存在');
    });

    it('记录统计失败时传递错误', async () => {
      mockedPost.mockResolvedValue({ success: false, data: null, error: '日期格式错误' });

      const result = await statsService.record(projectId, {
        date: 'invalid',
        wordsAdded: 100,
        wordsTotal: 100,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('日期格式错误');
    });
  });
});
