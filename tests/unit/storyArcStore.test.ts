import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock apiClient before importing the store
const mockGet = vi.fn();
const mockPost = vi.fn();
const mockPut = vi.fn();
const mockDelete = vi.fn();

vi.mock('../../src/services/apiClient.js', () => ({
  apiClient: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
    put: (...args: unknown[]) => mockPut(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
  },
}));

import { useStoryArcStore } from '../../src/stores/storyArcStore.js';

interface StoryArc {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  start_chapter: number | null;
  end_chapter: number | null;
  status: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface PlotThread {
  id: string;
  project_id: string;
  arc_id: string | null;
  name: string;
  description: string | null;
  status: string;
  priority: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

function makeArc(overrides: Partial<StoryArc> = {}): StoryArc {
  return {
    id: 'arc-1',
    project_id: 'proj-1',
    name: 'Main Arc',
    description: null,
    start_chapter: null,
    end_chapter: null,
    status: 'planned',
    sort_order: 0,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeThread(overrides: Partial<PlotThread> = {}): PlotThread {
  return {
    id: 'thread-1',
    project_id: 'proj-1',
    arc_id: null,
    name: 'Mystery Thread',
    description: null,
    status: 'open',
    priority: 'normal',
    sort_order: 0,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('storyArcStore', () => {
  beforeEach(() => {
    useStoryArcStore.setState({
      arcs: [],
      threads: [],
      isLoading: false,
      error: null,
    });
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('has empty arcs array', () => {
      expect(useStoryArcStore.getState().arcs).toEqual([]);
    });

    it('has empty threads array', () => {
      expect(useStoryArcStore.getState().threads).toEqual([]);
    });

    it('has isLoading false', () => {
      expect(useStoryArcStore.getState().isLoading).toBe(false);
    });

    it('has null error', () => {
      expect(useStoryArcStore.getState().error).toBeNull();
    });
  });

  describe('fetchArcs', () => {
    it('updates arcs state with fetched data', async () => {
      const arcs = [makeArc(), makeArc({ id: 'arc-2', name: 'Side Arc', sort_order: 1 })];
      mockGet.mockResolvedValue({ success: true, data: arcs, error: null });

      await useStoryArcStore.getState().fetchArcs('proj-1');

      expect(mockGet).toHaveBeenCalledWith('/projects/proj-1/story/arcs');
      expect(useStoryArcStore.getState().arcs).toEqual(arcs);
      expect(useStoryArcStore.getState().isLoading).toBe(false);
    });

    it('sets isLoading to true during fetch', async () => {
      let resolvePromise: (value: unknown) => void;
      mockGet.mockReturnValue(new Promise((resolve) => { resolvePromise = resolve; }));

      const fetchPromise = useStoryArcStore.getState().fetchArcs('proj-1');
      expect(useStoryArcStore.getState().isLoading).toBe(true);

      resolvePromise!({ success: true, data: [], error: null });
      await fetchPromise;

      expect(useStoryArcStore.getState().isLoading).toBe(false);
    });

    it('sets error on fetch failure', async () => {
      mockGet.mockRejectedValue(new Error('Network error'));

      await useStoryArcStore.getState().fetchArcs('proj-1');

      expect(useStoryArcStore.getState().error).toBe('Network error');
      expect(useStoryArcStore.getState().isLoading).toBe(false);
      expect(useStoryArcStore.getState().arcs).toEqual([]);
    });

    it('sets arcs to empty array when data is null', async () => {
      mockGet.mockResolvedValue({ success: true, data: null, error: null });

      await useStoryArcStore.getState().fetchArcs('proj-1');

      expect(useStoryArcStore.getState().arcs).toEqual([]);
    });

    it('clears previous error on new fetch', async () => {
      useStoryArcStore.setState({ error: 'Previous error' });
      mockGet.mockResolvedValue({ success: true, data: [], error: null });

      await useStoryArcStore.getState().fetchArcs('proj-1');

      expect(useStoryArcStore.getState().error).toBeNull();
    });
  });

  describe('fetchThreads', () => {
    it('updates threads state with fetched data', async () => {
      const threads = [makeThread(), makeThread({ id: 'thread-2', name: 'Second Thread' })];
      mockGet.mockResolvedValue({ success: true, data: threads, error: null });

      await useStoryArcStore.getState().fetchThreads('proj-1');

      expect(mockGet).toHaveBeenCalledWith('/projects/proj-1/story/threads');
      expect(useStoryArcStore.getState().threads).toEqual(threads);
      expect(useStoryArcStore.getState().isLoading).toBe(false);
    });

    it('sets error on fetch failure', async () => {
      mockGet.mockRejectedValue(new Error('Server down'));

      await useStoryArcStore.getState().fetchThreads('proj-1');

      expect(useStoryArcStore.getState().error).toBe('Server down');
      expect(useStoryArcStore.getState().isLoading).toBe(false);
    });

    it('sets threads to empty array when data is null', async () => {
      mockGet.mockResolvedValue({ success: true, data: null, error: null });

      await useStoryArcStore.getState().fetchThreads('proj-1');

      expect(useStoryArcStore.getState().threads).toEqual([]);
    });
  });

  describe('createArc', () => {
    it('adds a new arc to the state', async () => {
      const newArc = makeArc();
      mockPost.mockResolvedValue({ success: true, data: newArc, error: null });

      await useStoryArcStore.getState().createArc('proj-1', { name: 'Main Arc' });

      expect(mockPost).toHaveBeenCalledWith('/projects/proj-1/story/arcs', { name: 'Main Arc' });
      expect(useStoryArcStore.getState().arcs).toHaveLength(1);
      expect(useStoryArcStore.getState().arcs[0].id).toBe('arc-1');
    });

    it('adds arc to existing arcs list', async () => {
      useStoryArcStore.setState({ arcs: [makeArc()] });
      const secondArc = makeArc({ id: 'arc-2', name: 'Second Arc' });
      mockPost.mockResolvedValue({ success: true, data: secondArc, error: null });

      await useStoryArcStore.getState().createArc('proj-1', { name: 'Second Arc' });

      expect(useStoryArcStore.getState().arcs).toHaveLength(2);
    });

    it('does not add arc when response data is null', async () => {
      mockPost.mockResolvedValue({ success: true, data: null, error: null });

      await useStoryArcStore.getState().createArc('proj-1', { name: 'Arc' });

      expect(useStoryArcStore.getState().arcs).toHaveLength(0);
    });

    it('sets error on create failure', async () => {
      mockPost.mockRejectedValue(new Error('Create failed'));

      await useStoryArcStore.getState().createArc('proj-1', { name: 'Arc' });

      expect(useStoryArcStore.getState().error).toBe('Create failed');
    });

    it('sends description when provided', async () => {
      const newArc = makeArc({ description: 'A description' });
      mockPost.mockResolvedValue({ success: true, data: newArc, error: null });

      await useStoryArcStore.getState().createArc('proj-1', {
        name: 'Arc',
        description: 'A description',
      });

      expect(mockPost).toHaveBeenCalledWith('/projects/proj-1/story/arcs', {
        name: 'Arc',
        description: 'A description',
      });
    });
  });

  describe('updateArc', () => {
    it('updates an existing arc in state', async () => {
      const original = makeArc();
      useStoryArcStore.setState({ arcs: [original] });

      const updated = makeArc({ name: 'Updated Arc', status: 'active' });
      mockPut.mockResolvedValue({ success: true, data: updated, error: null });

      await useStoryArcStore.getState().updateArc('proj-1', 'arc-1', {
        name: 'Updated Arc',
        status: 'active',
      });

      expect(mockPut).toHaveBeenCalledWith('/projects/proj-1/story/arcs/arc-1', {
        name: 'Updated Arc',
        status: 'active',
      });
      expect(useStoryArcStore.getState().arcs[0].name).toBe('Updated Arc');
      expect(useStoryArcStore.getState().arcs[0].status).toBe('active');
    });

    it('does not modify other arcs when updating one', async () => {
      const arc1 = makeArc();
      const arc2 = makeArc({ id: 'arc-2', name: 'Other Arc' });
      useStoryArcStore.setState({ arcs: [arc1, arc2] });

      const updated = makeArc({ name: 'Updated Arc' });
      mockPut.mockResolvedValue({ success: true, data: updated, error: null });

      await useStoryArcStore.getState().updateArc('proj-1', 'arc-1', { name: 'Updated Arc' });

      expect(useStoryArcStore.getState().arcs).toHaveLength(2);
      expect(useStoryArcStore.getState().arcs[1].name).toBe('Other Arc');
    });

    it('does not update state when response data is null', async () => {
      const original = makeArc();
      useStoryArcStore.setState({ arcs: [original] });
      mockPut.mockResolvedValue({ success: true, data: null, error: null });

      await useStoryArcStore.getState().updateArc('proj-1', 'arc-1', { name: 'New' });

      expect(useStoryArcStore.getState().arcs[0].name).toBe('Main Arc');
    });

    it('sets error on update failure', async () => {
      const original = makeArc();
      useStoryArcStore.setState({ arcs: [original] });
      mockPut.mockRejectedValue(new Error('Update failed'));

      await useStoryArcStore.getState().updateArc('proj-1', 'arc-1', { name: 'New' });

      expect(useStoryArcStore.getState().error).toBe('Update failed');
      // State unchanged
      expect(useStoryArcStore.getState().arcs[0].name).toBe('Main Arc');
    });
  });

  describe('deleteArc', () => {
    it('removes an arc from state', async () => {
      const arc1 = makeArc();
      const arc2 = makeArc({ id: 'arc-2', name: 'Arc 2' });
      useStoryArcStore.setState({ arcs: [arc1, arc2] });
      mockDelete.mockResolvedValue({ success: true });

      await useStoryArcStore.getState().deleteArc('proj-1', 'arc-1');

      expect(mockDelete).toHaveBeenCalledWith('/projects/proj-1/story/arcs/arc-1');
      expect(useStoryArcStore.getState().arcs).toHaveLength(1);
      expect(useStoryArcStore.getState().arcs[0].id).toBe('arc-2');
    });

    it('removes the only arc leaving empty array', async () => {
      useStoryArcStore.setState({ arcs: [makeArc()] });
      mockDelete.mockResolvedValue({ success: true });

      await useStoryArcStore.getState().deleteArc('proj-1', 'arc-1');

      expect(useStoryArcStore.getState().arcs).toEqual([]);
    });

    it('sets error on delete failure', async () => {
      useStoryArcStore.setState({ arcs: [makeArc()] });
      mockDelete.mockRejectedValue(new Error('Delete failed'));

      await useStoryArcStore.getState().deleteArc('proj-1', 'arc-1');

      expect(useStoryArcStore.getState().error).toBe('Delete failed');
      // Arc is still removed optimistically from state since filter runs
      // The store filters unconditionally, but sets error
    });
  });

  describe('reorderArcs', () => {
    it('updates sort_order for reordered arcs', async () => {
      const arc1 = makeArc({ sort_order: 0 });
      const arc2 = makeArc({ id: 'arc-2', name: 'Arc 2', sort_order: 1 });
      useStoryArcStore.setState({ arcs: [arc1, arc2] });
      mockPut.mockResolvedValue({ success: true });

      await useStoryArcStore.getState().reorderArcs('proj-1', [
        { id: 'arc-1', sortOrder: 1 },
        { id: 'arc-2', sortOrder: 0 },
      ]);

      expect(mockPut).toHaveBeenCalledWith('/projects/proj-1/story/arcs/reorder', {
        items: [{ id: 'arc-1', sortOrder: 1 }, { id: 'arc-2', sortOrder: 0 }],
      });

      const arcs = useStoryArcStore.getState().arcs;
      expect(arcs.find((a) => a.id === 'arc-1')!.sort_order).toBe(1);
      expect(arcs.find((a) => a.id === 'arc-2')!.sort_order).toBe(0);
    });

    it('leaves unmentioned arcs unchanged', async () => {
      const arc1 = makeArc({ sort_order: 0 });
      const arc2 = makeArc({ id: 'arc-2', name: 'Arc 2', sort_order: 1 });
      const arc3 = makeArc({ id: 'arc-3', name: 'Arc 3', sort_order: 2 });
      useStoryArcStore.setState({ arcs: [arc1, arc2, arc3] });
      mockPut.mockResolvedValue({ success: true });

      await useStoryArcStore.getState().reorderArcs('proj-1', [
        { id: 'arc-1', sortOrder: 2 },
      ]);

      const arcs = useStoryArcStore.getState().arcs;
      expect(arcs.find((a) => a.id === 'arc-1')!.sort_order).toBe(2);
      expect(arcs.find((a) => a.id === 'arc-2')!.sort_order).toBe(1);
      expect(arcs.find((a) => a.id === 'arc-3')!.sort_order).toBe(2);
    });

    it('sets error on reorder failure', async () => {
      useStoryArcStore.setState({ arcs: [makeArc()] });
      mockPut.mockRejectedValue(new Error('Reorder failed'));

      await useStoryArcStore.getState().reorderArcs('proj-1', [
        { id: 'arc-1', sortOrder: 5 },
      ]);

      expect(useStoryArcStore.getState().error).toBe('Reorder failed');
    });
  });

  describe('createThread', () => {
    it('adds a new thread to the state', async () => {
      const newThread = makeThread();
      mockPost.mockResolvedValue({ success: true, data: newThread, error: null });

      await useStoryArcStore.getState().createThread('proj-1', { name: 'Mystery Thread' });

      expect(mockPost).toHaveBeenCalledWith('/projects/proj-1/story/threads', {
        name: 'Mystery Thread',
      });
      expect(useStoryArcStore.getState().threads).toHaveLength(1);
      expect(useStoryArcStore.getState().threads[0].id).toBe('thread-1');
    });

    it('sends arcId and description when provided', async () => {
      const newThread = makeThread({ arc_id: 'arc-1', description: 'A clue' });
      mockPost.mockResolvedValue({ success: true, data: newThread, error: null });

      await useStoryArcStore.getState().createThread('proj-1', {
        name: 'Mystery',
        arcId: 'arc-1',
        description: 'A clue',
      });

      expect(mockPost).toHaveBeenCalledWith('/projects/proj-1/story/threads', {
        name: 'Mystery',
        arcId: 'arc-1',
        description: 'A clue',
      });
    });

    it('does not add thread when response data is null', async () => {
      mockPost.mockResolvedValue({ success: true, data: null, error: null });

      await useStoryArcStore.getState().createThread('proj-1', { name: 'Thread' });

      expect(useStoryArcStore.getState().threads).toHaveLength(0);
    });

    it('sets error on create failure', async () => {
      mockPost.mockRejectedValue(new Error('Thread create failed'));

      await useStoryArcStore.getState().createThread('proj-1', { name: 'Thread' });

      expect(useStoryArcStore.getState().error).toBe('Thread create failed');
    });
  });

  describe('updateThread', () => {
    it('updates an existing thread in state', async () => {
      const original = makeThread();
      useStoryArcStore.setState({ threads: [original] });

      const updated = makeThread({ name: 'Updated Thread', status: 'resolved' });
      mockPut.mockResolvedValue({ success: true, data: updated, error: null });

      await useStoryArcStore.getState().updateThread('proj-1', 'thread-1', {
        name: 'Updated Thread',
        status: 'resolved',
      });

      expect(mockPut).toHaveBeenCalledWith('/projects/proj-1/story/threads/thread-1', {
        name: 'Updated Thread',
        status: 'resolved',
      });
      expect(useStoryArcStore.getState().threads[0].name).toBe('Updated Thread');
      expect(useStoryArcStore.getState().threads[0].status).toBe('resolved');
    });

    it('does not modify other threads when updating one', async () => {
      const t1 = makeThread();
      const t2 = makeThread({ id: 'thread-2', name: 'Other Thread' });
      useStoryArcStore.setState({ threads: [t1, t2] });

      const updated = makeThread({ name: 'Updated Thread' });
      mockPut.mockResolvedValue({ success: true, data: updated, error: null });

      await useStoryArcStore.getState().updateThread('proj-1', 'thread-1', { name: 'Updated Thread' });

      expect(useStoryArcStore.getState().threads).toHaveLength(2);
      expect(useStoryArcStore.getState().threads[1].name).toBe('Other Thread');
    });

    it('sets error on update failure', async () => {
      useStoryArcStore.setState({ threads: [makeThread()] });
      mockPut.mockRejectedValue(new Error('Thread update failed'));

      await useStoryArcStore.getState().updateThread('proj-1', 'thread-1', { name: 'New' });

      expect(useStoryArcStore.getState().error).toBe('Thread update failed');
    });
  });

  describe('deleteThread', () => {
    it('removes a thread from state', async () => {
      const t1 = makeThread();
      const t2 = makeThread({ id: 'thread-2', name: 'Thread 2' });
      useStoryArcStore.setState({ threads: [t1, t2] });
      mockDelete.mockResolvedValue({ success: true });

      await useStoryArcStore.getState().deleteThread('proj-1', 'thread-1');

      expect(mockDelete).toHaveBeenCalledWith('/projects/proj-1/story/threads/thread-1');
      expect(useStoryArcStore.getState().threads).toHaveLength(1);
      expect(useStoryArcStore.getState().threads[0].id).toBe('thread-2');
    });

    it('sets error on delete failure', async () => {
      useStoryArcStore.setState({ threads: [makeThread()] });
      mockDelete.mockRejectedValue(new Error('Thread delete failed'));

      await useStoryArcStore.getState().deleteThread('proj-1', 'thread-1');

      expect(useStoryArcStore.getState().error).toBe('Thread delete failed');
    });
  });

  describe('reorderThreads', () => {
    it('updates sort_order for reordered threads', async () => {
      const t1 = makeThread({ sort_order: 0 });
      const t2 = makeThread({ id: 'thread-2', name: 'Thread 2', sort_order: 1 });
      useStoryArcStore.setState({ threads: [t1, t2] });
      mockPut.mockResolvedValue({ success: true });

      await useStoryArcStore.getState().reorderThreads('proj-1', [
        { id: 'thread-1', sortOrder: 1 },
        { id: 'thread-2', sortOrder: 0 },
      ]);

      expect(mockPut).toHaveBeenCalledWith('/projects/proj-1/story/threads/reorder', {
        items: [{ id: 'thread-1', sortOrder: 1 }, { id: 'thread-2', sortOrder: 0 }],
      });

      const threads = useStoryArcStore.getState().threads;
      expect(threads.find((t) => t.id === 'thread-1')!.sort_order).toBe(1);
      expect(threads.find((t) => t.id === 'thread-2')!.sort_order).toBe(0);
    });

    it('sets error on reorder failure', async () => {
      useStoryArcStore.setState({ threads: [makeThread()] });
      mockPut.mockRejectedValue(new Error('Thread reorder failed'));

      await useStoryArcStore.getState().reorderThreads('proj-1', [
        { id: 'thread-1', sortOrder: 5 },
      ]);

      expect(useStoryArcStore.getState().error).toBe('Thread reorder failed');
    });
  });

  describe('clearError', () => {
    it('clears error state', () => {
      useStoryArcStore.setState({ error: 'Something went wrong' });
      expect(useStoryArcStore.getState().error).toBe('Something went wrong');

      useStoryArcStore.getState().clearError();

      expect(useStoryArcStore.getState().error).toBeNull();
    });

    it('does not affect other state when clearing error', () => {
      const arc = makeArc();
      useStoryArcStore.setState({
        arcs: [arc],
        threads: [],
        isLoading: true,
        error: 'Error',
      });

      useStoryArcStore.getState().clearError();

      expect(useStoryArcStore.getState().arcs).toEqual([arc]);
      expect(useStoryArcStore.getState().threads).toEqual([]);
      expect(useStoryArcStore.getState().isLoading).toBe(true);
      expect(useStoryArcStore.getState().error).toBeNull();
    });
  });
});
