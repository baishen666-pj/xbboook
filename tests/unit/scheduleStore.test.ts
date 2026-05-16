import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useScheduleStore } from '@/stores/scheduleStore';
import type { ScheduleItem, PublishStatus } from '@/types/project';

vi.mock('@/services/chapterService', () => ({
  chapterService: {
    fetchSchedule: vi.fn(),
    updatePublishStatus: vi.fn(),
  },
}));

import { chapterService } from '@/services/chapterService';

const mockScheduleItems: ScheduleItem[] = [
  {
    id: 'ch-1',
    title: '第一章 初入江湖',
    wordCount: 3200,
    publishStatus: 'draft',
    scheduledAt: null,
    sortOrder: 0,
  },
  {
    id: 'ch-2',
    title: '第二章 奇遇',
    wordCount: 2800,
    publishStatus: 'scheduled',
    scheduledAt: '2026-06-01T10:00:00Z',
    sortOrder: 1,
  },
  {
    id: 'ch-3',
    title: '第三章 突破',
    wordCount: 4100,
    publishStatus: 'published',
    scheduledAt: null,
    sortOrder: 2,
  },
  {
    id: 'ch-4',
    title: '第四章 旧事',
    wordCount: 1500,
    publishStatus: 'archived',
    scheduledAt: null,
    sortOrder: 3,
  },
];

describe('scheduleStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useScheduleStore.setState({
      scheduleItems: [],
      loading: false,
    });
  });

  describe('fetchSchedule', () => {
    it('fetches schedule items and updates state', async () => {
      (chapterService.fetchSchedule as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockScheduleItems,
      });

      await useScheduleStore.getState().fetchSchedule('proj-1');

      const state = useScheduleStore.getState();
      expect(state.scheduleItems).toEqual(mockScheduleItems);
      expect(state.loading).toBe(false);
    });

    it('sets loading to true during fetch', async () => {
      let resolvePromise: (value: any) => void;
      const pending = new Promise((resolve) => { resolvePromise = resolve; });
      (chapterService.fetchSchedule as ReturnType<typeof vi.fn>).mockReturnValue(pending);

      const promise = useScheduleStore.getState().fetchSchedule('proj-1');

      expect(useScheduleStore.getState().loading).toBe(true);

      resolvePromise!({ success: true, data: mockScheduleItems });
      await promise;

      expect(useScheduleStore.getState().loading).toBe(false);
    });

    it('handles failed fetch gracefully', async () => {
      (chapterService.fetchSchedule as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: false,
        error: 'Network error',
      });

      await useScheduleStore.getState().fetchSchedule('proj-1');

      const state = useScheduleStore.getState();
      expect(state.scheduleItems).toEqual([]);
      expect(state.loading).toBe(false);
    });
  });

  describe('updatePublishStatus', () => {
    beforeEach(() => {
      useScheduleStore.setState({
        scheduleItems: mockScheduleItems,
        projectId: 'proj-1',
      });
    });

    it('updates publish status of a chapter in state', async () => {
      (chapterService.updatePublishStatus as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: {
          id: 'ch-1',
          publishStatus: 'scheduled',
          scheduledAt: '2026-07-01T10:00:00Z',
        },
      });

      await useScheduleStore
        .getState()
        .updatePublishStatus('ch-1', 'scheduled', '2026-07-01T10:00:00Z');

      const state = useScheduleStore.getState();
      const updated = state.scheduleItems.find((i) => i.id === 'ch-1');
      expect(updated?.publishStatus).toBe('scheduled');
      expect(updated?.scheduledAt).toBe('2026-07-01T10:00:00Z');
      expect(chapterService.updatePublishStatus).toHaveBeenCalledWith(
        'proj-1', 'ch-1',
        { publish_status: 'scheduled', scheduled_at: '2026-07-01T10:00:00Z' }
      );
    });

    it('does not update state when API call fails', async () => {
      (chapterService.updatePublishStatus as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: false,
        error: 'Not found',
      });

      await useScheduleStore
        .getState()
        .updatePublishStatus('ch-1', 'published');

      const state = useScheduleStore.getState();
      const unchanged = state.scheduleItems.find((i) => i.id === 'ch-1');
      expect(unchanged?.publishStatus).toBe('draft');
    });

    it('does nothing when projectId is null', async () => {
      useScheduleStore.setState({ projectId: null });

      await useScheduleStore
        .getState()
        .updatePublishStatus('ch-1', 'published');

      expect(chapterService.updatePublishStatus).not.toHaveBeenCalled();
    });

    it('only updates the target chapter, leaving others unchanged', async () => {
      (chapterService.updatePublishStatus as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: {
          id: 'ch-2',
          publishStatus: 'published',
          scheduledAt: null,
        },
      });

      await useScheduleStore
        .getState()
        .updatePublishStatus('ch-2', 'published');

      const state = useScheduleStore.getState();
      const updated = state.scheduleItems.find((i) => i.id === 'ch-2');
      const unchanged = state.scheduleItems.find((i) => i.id === 'ch-1');
      expect(updated?.publishStatus).toBe('published');
      expect(unchanged?.publishStatus).toBe('draft');
    });
  });

  describe('clear', () => {
    it('resets scheduleItems, loading, and projectId', () => {
      useScheduleStore.setState({
        scheduleItems: mockScheduleItems,
        loading: true,
        projectId: 'proj-1',
      });

      useScheduleStore.getState().clear();

      const state = useScheduleStore.getState();
      expect(state.scheduleItems).toEqual([]);
      expect(state.loading).toBe(false);
      expect(state.projectId).toBeNull();
    });
  });
});