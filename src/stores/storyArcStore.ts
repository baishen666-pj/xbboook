import { create } from 'zustand';
import { apiClient } from '../services/apiClient.js';

interface StoryArc {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  start_chapter: number | null;
  end_chapter: number | null;
  status: 'planned' | 'active' | 'completed' | 'abandoned';
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
  status: 'open' | 'resolved' | 'dormant' | 'abandoned';
  priority: 'critical' | 'high' | 'normal' | 'low';
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface StoryArcState {
  arcs: StoryArc[];
  threads: PlotThread[];
  isLoading: boolean;
  error: string | null;

  fetchArcs: (projectId: string) => Promise<void>;
  fetchThreads: (projectId: string) => Promise<void>;
  createArc: (projectId: string, data: { name: string; description?: string }) => Promise<void>;
  updateArc: (projectId: string, arcId: string, data: Partial<StoryArc>) => Promise<void>;
  deleteArc: (projectId: string, arcId: string) => Promise<void>;
  reorderArcs: (projectId: string, items: { id: string; sortOrder: number }[]) => Promise<void>;
  createThread: (projectId: string, data: { name: string; arcId?: string; description?: string }) => Promise<void>;
  updateThread: (projectId: string, threadId: string, data: Partial<PlotThread>) => Promise<void>;
  deleteThread: (projectId: string, threadId: string) => Promise<void>;
  reorderThreads: (projectId: string, items: { id: string; sortOrder: number }[]) => Promise<void>;
  clearError: () => void;
}

export const useStoryArcStore = create<StoryArcState>((set) => ({
  arcs: [],
  threads: [],
  isLoading: false,
  error: null,

  fetchArcs: async (projectId) => {
    set({ isLoading: true, error: null });
    try {
      const res = await apiClient.get<StoryArc[]>(`/projects/${projectId}/story/arcs`);
      set({ arcs: res.data ?? [], isLoading: false });
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  fetchThreads: async (projectId) => {
    set({ isLoading: true, error: null });
    try {
      const res = await apiClient.get<PlotThread[]>(`/projects/${projectId}/story/threads`);
      set({ threads: res.data ?? [], isLoading: false });
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  createArc: async (projectId, data) => {
    try {
      const res = await apiClient.post<StoryArc>(`/projects/${projectId}/story/arcs`, data);
      if (res.data) {
        set((state) => ({ arcs: [...state.arcs, res.data!] }));
      }
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  updateArc: async (projectId, arcId, data) => {
    try {
      const res = await apiClient.put<StoryArc>(`/projects/${projectId}/story/arcs/${arcId}`, data);
      if (res.data) {
        set((state) => ({
          arcs: state.arcs.map((a) => a.id === arcId ? res.data! : a),
        }));
      }
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  deleteArc: async (projectId, arcId) => {
    try {
      await apiClient.delete(`/projects/${projectId}/story/arcs/${arcId}`);
      set((state) => ({ arcs: state.arcs.filter((a) => a.id !== arcId) }));
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  reorderArcs: async (projectId, items) => {
    try {
      await apiClient.put(`/projects/${projectId}/story/arcs/reorder`, { items });
      set((state) => ({
        arcs: state.arcs.map((arc) => {
          const item = items.find((i) => i.id === arc.id);
          return item ? { ...arc, sort_order: item.sortOrder } : arc;
        }),
      }));
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  createThread: async (projectId, data) => {
    try {
      const res = await apiClient.post<PlotThread>(`/projects/${projectId}/story/threads`, data);
      if (res.data) {
        set((state) => ({ threads: [...state.threads, res.data!] }));
      }
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  updateThread: async (projectId, threadId, data) => {
    try {
      const res = await apiClient.put<PlotThread>(`/projects/${projectId}/story/threads/${threadId}`, data);
      if (res.data) {
        set((state) => ({
          threads: state.threads.map((t) => t.id === threadId ? res.data! : t),
        }));
      }
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  deleteThread: async (projectId, threadId) => {
    try {
      await apiClient.delete(`/projects/${projectId}/story/threads/${threadId}`);
      set((state) => ({ threads: state.threads.filter((t) => t.id !== threadId) }));
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  reorderThreads: async (projectId, items) => {
    try {
      await apiClient.put(`/projects/${projectId}/story/threads/reorder`, { items });
      set((state) => ({
        threads: state.threads.map((thread) => {
          const item = items.find((i) => i.id === thread.id);
          return item ? { ...thread, sort_order: item.sortOrder } : thread;
        }),
      }));
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  clearError: () => set({ error: null }),
}));
