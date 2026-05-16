import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/services/analyticsService', () => ({
  analyticsService: {
    getDashboard: vi.fn(),
    getCharacterAppearances: vi.fn(),
  },
}));

import { useAnalyticsStore } from '@/stores/analyticsStore';
import { analyticsService } from '@/services/analyticsService';

const mockDashboard = {
  summary: { totalWords: 1000, totalDays: 5, avgDaily: 200, bestDay: null },
  velocity: [{ date: '2026-01-10', words: 500, sessions: 2 }],
  chapterStatus: [{ status: 'draft', count: 3 }],
  streak: { current: 2, longest: 5 },
  target: { target: 50000, current: 1000, percentage: 2 },
  peakHours: Array.from({ length: 24 }, (_, i) => ({ hour: i, count: 0 })),
};

describe('analyticsStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAnalyticsStore.setState({
      dashboard: null,
      characters: [],
      loading: false,
      error: null,
    });
  });

  describe('fetchDashboard', () => {
    it('sets dashboard data on success', async () => {
      vi.mocked(analyticsService.getDashboard).mockResolvedValue({
        success: true, data: mockDashboard, error: null,
      });

      await useAnalyticsStore.getState().fetchDashboard('proj-1');

      const state = useAnalyticsStore.getState();
      expect(state.dashboard).toEqual(mockDashboard);
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('sets error on failure', async () => {
      vi.mocked(analyticsService.getDashboard).mockResolvedValue({
        success: false, data: null, error: 'Network error',
      });

      await useAnalyticsStore.getState().fetchDashboard('proj-1');

      const state = useAnalyticsStore.getState();
      expect(state.dashboard).toBeNull();
      expect(state.loading).toBe(false);
      expect(state.error).toBe('Network error');
    });

    it('sets default error message when no error string', async () => {
      vi.mocked(analyticsService.getDashboard).mockResolvedValue({
        success: false, data: null, error: null,
      });

      await useAnalyticsStore.getState().fetchDashboard('proj-1');

      const state = useAnalyticsStore.getState();
      expect(state.error).toBe('加载失败');
    });

    it('sets loading to true during fetch', async () => {
      let resolvePromise: (v: unknown) => void;
      const pending = new Promise(resolve => { resolvePromise = resolve; });
      vi.mocked(analyticsService.getDashboard).mockReturnValue(pending as any);

      const promise = useAnalyticsStore.getState().fetchDashboard('proj-1');

      expect(useAnalyticsStore.getState().loading).toBe(true);

      resolvePromise!({ success: true, data: mockDashboard, error: null });
      await promise;

      expect(useAnalyticsStore.getState().loading).toBe(false);
    });

    it('passes days parameter', async () => {
      vi.mocked(analyticsService.getDashboard).mockResolvedValue({
        success: true, data: mockDashboard, error: null,
      });

      await useAnalyticsStore.getState().fetchDashboard('proj-1', 7);

      expect(analyticsService.getDashboard).toHaveBeenCalledWith('proj-1', 7);
    });

    it('defaults days to 30', async () => {
      vi.mocked(analyticsService.getDashboard).mockResolvedValue({
        success: true, data: mockDashboard, error: null,
      });

      await useAnalyticsStore.getState().fetchDashboard('proj-1');

      expect(analyticsService.getDashboard).toHaveBeenCalledWith('proj-1', 30);
    });
  });

  describe('fetchCharacters', () => {
    it('sets characters on success', async () => {
      const mockChars = [{ name: 'Alice', count: 10 }, { name: 'Bob', count: 5 }];
      vi.mocked(analyticsService.getCharacterAppearances).mockResolvedValue({
        success: true, data: mockChars, error: null,
      });

      await useAnalyticsStore.getState().fetchCharacters('proj-1');

      expect(useAnalyticsStore.getState().characters).toEqual(mockChars);
    });

    it('does not update characters on failure', async () => {
      useAnalyticsStore.setState({ characters: [{ name: 'Existing', count: 1 }] });
      vi.mocked(analyticsService.getCharacterAppearances).mockResolvedValue({
        success: false, data: null, error: 'Failed',
      });

      await useAnalyticsStore.getState().fetchCharacters('proj-1');

      expect(useAnalyticsStore.getState().characters).toEqual([{ name: 'Existing', count: 1 }]);
    });
  });
});
