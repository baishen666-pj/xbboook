import { create } from "zustand";
import { commentService } from "@/services/commentService";
import type { ChapterComment } from "@/types/project";

interface CommentState {
  comments: ChapterComment[];
  loading: boolean;
  fetchComments: (projectId: string, chapterId: string) => Promise<void>;
  addComment: (projectId: string, chapterId: string, data: {
    content: string;
    userId: string;
    selectionFrom?: number;
    selectionTo?: number;
    selectionText?: string;
  }) => Promise<void>;
  resolveComment: (projectId: string, chapterId: string, commentId: string) => Promise<void>;
  removeComment: (projectId: string, chapterId: string, commentId: string) => Promise<void>;
  clear: () => void;
}

export const useCommentStore = create<CommentState>((set) => ({
  comments: [],
  loading: false,

  fetchComments: async (projectId, chapterId) => {
    set({ loading: true });
    const res = await commentService.getComments(projectId, chapterId);
    if (res.success && res.data) {
      set({ comments: res.data, loading: false });
    } else {
      set({ loading: false });
    }
  },

  addComment: async (projectId, chapterId, data) => {
    const res = await commentService.create(projectId, chapterId, data);
    if (res.success && res.data) {
      set((s) => ({ comments: [...s.comments, res.data!] }));
    }
  },

  resolveComment: async (projectId, chapterId, commentId) => {
    const res = await commentService.resolve(projectId, chapterId, commentId);
    if (res.success && res.data) {
      set((s) => ({
        comments: s.comments.map((c) => c.id === commentId ? res.data! : c),
      }));
    }
  },

  removeComment: async (projectId, chapterId, commentId) => {
    const res = await commentService.remove(projectId, chapterId, commentId);
    if (res.success) {
      set((s) => ({ comments: s.comments.filter((c) => c.id !== commentId) }));
    }
  },

  clear: () => set({ comments: [], loading: false }),
}));
