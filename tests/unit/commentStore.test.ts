/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/services/commentService', () => ({
  commentService: {
    getComments: vi.fn(),
    create: vi.fn(),
    resolve: vi.fn(),
    remove: vi.fn(),
  },
}));

import { useCommentStore } from '@/stores/commentStore';
import { commentService } from '@/services/commentService';

const mockCommentService = commentService as unknown as {
  getComments: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  resolve: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
};

const fakeComment = {
  id: 'c1',
  chapter_id: 'ch1',
  project_id: 'p1',
  user_id: 'u1',
  content: 'Test comment',
  selection_from: null as number | null,
  selection_to: null as number | null,
  selection_text: null as string | null,
  resolved: 0,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

describe('commentStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useCommentStore.setState({ comments: [], loading: false });
  });

  describe('initial state', () => {
    it('starts with empty comments and loading false', () => {
      const state = useCommentStore.getState();
      expect(state.comments).toEqual([]);
      expect(state.loading).toBe(false);
    });
  });

  describe('fetchComments', () => {
    it('loads comments on success', async () => {
      mockCommentService.getComments.mockResolvedValue({
        success: true,
        data: [fakeComment],
        error: null,
      });

      await useCommentStore.getState().fetchComments('p1', 'ch1');

      expect(useCommentStore.getState().comments).toEqual([fakeComment]);
      expect(useCommentStore.getState().loading).toBe(false);
    });

    it('sets loading to true during fetch, then false', async () => {
      let loadingDuringFetch = false;
      mockCommentService.getComments.mockImplementation(async () => {
        loadingDuringFetch = useCommentStore.getState().loading;
        return { success: true, data: [], error: null };
      });

      await useCommentStore.getState().fetchComments('p1', 'ch1');

      expect(loadingDuringFetch).toBe(true);
      expect(useCommentStore.getState().loading).toBe(false);
    });

    it('handles failure gracefully', async () => {
      mockCommentService.getComments.mockResolvedValue({
        success: false,
        data: null,
        error: 'Network error',
      });

      await useCommentStore.getState().fetchComments('p1', 'ch1');

      expect(useCommentStore.getState().comments).toEqual([]);
      expect(useCommentStore.getState().loading).toBe(false);
    });

    it('handles null data gracefully', async () => {
      mockCommentService.getComments.mockResolvedValue({
        success: true,
        data: null,
        error: null,
      });

      await useCommentStore.getState().fetchComments('p1', 'ch1');

      expect(useCommentStore.getState().loading).toBe(false);
    });
  });

  describe('addComment', () => {
    it('appends new comment on success', async () => {
      useCommentStore.setState({ comments: [fakeComment] });

      const newComment = { ...fakeComment, id: 'c2', content: 'New' };
      mockCommentService.create.mockResolvedValue({
        success: true,
        data: newComment,
        error: null,
      });

      await useCommentStore.getState().addComment('p1', 'ch1', {
        content: 'New',
        userId: 'u1',
      });

      expect(useCommentStore.getState().comments).toHaveLength(2);
      expect(useCommentStore.getState().comments[1].id).toBe('c2');
    });

    it('does not mutate the original array', async () => {
      const original = [fakeComment];
      useCommentStore.setState({ comments: original });

      const newComment = { ...fakeComment, id: 'c2' };
      mockCommentService.create.mockResolvedValue({
        success: true,
        data: newComment,
        error: null,
      });

      await useCommentStore.getState().addComment('p1', 'ch1', {
        content: 'Test',
        userId: 'u1',
      });

      expect(original).toHaveLength(1);
    });

    it('does not add comment on failure', async () => {
      useCommentStore.setState({ comments: [] });
      mockCommentService.create.mockResolvedValue({
        success: false,
        data: null,
        error: 'Error',
      });

      await useCommentStore.getState().addComment('p1', 'ch1', {
        content: 'Test',
        userId: 'u1',
      });

      expect(useCommentStore.getState().comments).toHaveLength(0);
    });

    it('passes selection data to service', async () => {
      mockCommentService.create.mockResolvedValue({
        success: true,
        data: fakeComment,
        error: null,
      });

      await useCommentStore.getState().addComment('p1', 'ch1', {
        content: 'Test',
        userId: 'u1',
        selectionFrom: 10,
        selectionTo: 20,
        selectionText: 'selected text',
      });

      expect(mockCommentService.create).toHaveBeenCalledWith('p1', 'ch1', {
        content: 'Test',
        userId: 'u1',
        selectionFrom: 10,
        selectionTo: 20,
        selectionText: 'selected text',
      });
    });
  });

  describe('resolveComment', () => {
    it('replaces comment with resolved version on success', async () => {
      useCommentStore.setState({ comments: [fakeComment] });

      const resolved = { ...fakeComment, resolved: 1 };
      mockCommentService.resolve.mockResolvedValue({
        success: true,
        data: resolved,
        error: null,
      });

      await useCommentStore.getState().resolveComment('p1', 'ch1', 'c1');

      expect(useCommentStore.getState().comments[0].resolved).toBe(1);
    });

    it('does not modify comments on failure', async () => {
      useCommentStore.setState({ comments: [fakeComment] });
      mockCommentService.resolve.mockResolvedValue({
        success: false,
        data: null,
        error: 'Error',
      });

      await useCommentStore.getState().resolveComment('p1', 'ch1', 'c1');

      expect(useCommentStore.getState().comments[0].resolved).toBe(0);
    });
  });

  describe('removeComment', () => {
    it('removes comment from list on success', async () => {
      const c2 = { ...fakeComment, id: 'c2' };
      useCommentStore.setState({ comments: [fakeComment, c2] });

      mockCommentService.remove.mockResolvedValue({
        success: true,
        data: null,
        error: null,
      });

      await useCommentStore.getState().removeComment('p1', 'ch1', 'c1');

      expect(useCommentStore.getState().comments).toHaveLength(1);
      expect(useCommentStore.getState().comments[0].id).toBe('c2');
    });

    it('does not remove comment on failure', async () => {
      useCommentStore.setState({ comments: [fakeComment] });
      mockCommentService.remove.mockResolvedValue({
        success: false,
        data: null,
        error: 'Error',
      });

      await useCommentStore.getState().removeComment('p1', 'ch1', 'c1');

      expect(useCommentStore.getState().comments).toHaveLength(1);
    });
  });

  describe('clear', () => {
    it('resets state to initial values', () => {
      useCommentStore.setState({
        comments: [fakeComment],
        loading: true,
      });

      useCommentStore.getState().clear();

      expect(useCommentStore.getState().comments).toEqual([]);
      expect(useCommentStore.getState().loading).toBe(false);
    });
  });
});
