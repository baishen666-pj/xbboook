import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock apiClient before importing the service
vi.mock('@/services/apiClient', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import { analyticsService } from '@/services/analyticsService';
import { apiClient } from '@/services/apiClient';

describe('analyticsService (client)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getDashboard', () => {
    it('calls GET /projects/:id/stats/dashboard with days param', async () => {
      const mockData = {
        summary: { totalWords: 1000, totalDays: 5, avgDaily: 200, bestDay: null },
        velocity: [], chapterStatus: [], streak: { current: 0, longest: 0 },
        target: { target: 0, current: 0, percentage: 0 }, peakHours: [],
      };
      vi.mocked(apiClient.get).mockResolvedValue({ success: true, data: mockData, error: null });

      const result = await analyticsService.getDashboard('proj-1', 14);

      expect(apiClient.get).toHaveBeenCalledWith('/projects/proj-1/stats/dashboard?days=14');
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockData);
    });

    it('defaults days to 30', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ success: true, data: null, error: null });

      await analyticsService.getDashboard('proj-1');

      expect(apiClient.get).toHaveBeenCalledWith('/projects/proj-1/stats/dashboard?days=30');
    });
  });

  describe('getCharacterAppearances', () => {
    it('calls GET /projects/:id/stats/characters', async () => {
      const mockData = [{ name: 'Alice', count: 5 }];
      vi.mocked(apiClient.get).mockResolvedValue({ success: true, data: mockData, error: null });

      const result = await analyticsService.getCharacterAppearances('proj-1');

      expect(apiClient.get).toHaveBeenCalledWith('/projects/proj-1/stats/characters');
      expect(result.data).toEqual(mockData);
    });
  });

  describe('startSession', () => {
    it('calls POST /projects/:id/stats/session', async () => {
      const mockSession = { id: 's1', projectId: 'proj-1', chapterId: 'ch1', startedAt: '2026-01-01', endedAt: null, wordsStart: 0, wordsEnd: 0, durationMs: 0 };
      vi.mocked(apiClient.post).mockResolvedValue({ success: true, data: mockSession, error: null });

      const result = await analyticsService.startSession('proj-1', { chapterId: 'ch1', wordsStart: 100 });

      expect(apiClient.post).toHaveBeenCalledWith('/projects/proj-1/stats/session', { chapterId: 'ch1', wordsStart: 100 });
      expect(result.data).toEqual(mockSession);
    });
  });

  describe('endSession', () => {
    it('calls PUT /projects/:id/stats/session/:sessionId', async () => {
      const mockSession = { id: 's1', projectId: 'proj-1', chapterId: 'ch1', startedAt: '2026-01-01', endedAt: '2026-01-01', wordsStart: 100, wordsEnd: 350, durationMs: 60000 };
      vi.mocked(apiClient.put).mockResolvedValue({ success: true, data: mockSession, error: null });

      const result = await analyticsService.endSession('proj-1', 's1', 350);

      expect(apiClient.put).toHaveBeenCalledWith('/projects/proj-1/stats/session/s1', { wordsEnd: 350 });
      expect(result.data!.wordsEnd).toBe(350);
    });
  });
});
