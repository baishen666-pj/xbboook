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
  updateArc: (arcId: string, data: Partial<StoryArc>) => Promise<void>;
  deleteArc: (arcId: string) => Promise<void>;
  createThread: (projectId: string, data: { name: string; arcId?: string; description?: string }) => Promise<void>;
  updateThread: (threadId: string, data: Partial<PlotThread>) => Promise<void>;
  deleteThread: (threadId: string) => Promise<void>;
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

  updateArc: async (arcId, data) => {
    try {
      const res = await apiClient.put<StoryArc>(`/story/arcs/${arcId}`, data);
      if (res.data) {
        set((state) => ({
          arcs: state.arcs.map((a) => a.id === arcId ? res.data! : a),
        }));
      }
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  deleteArc: async (arcId) => {
    try {
      await apiClient.delete(`/story/arcs/${arcId}`);
      set((state) => ({ arcs: state.arcs.filter((a) => a.id !== arcId) }));
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

  updateThread: async (threadId, data) => {
    try {
      const res = await apiClient.put<PlotThread>(`/story/threads/${threadId}`, data);
      if (res.data) {
        set((state) => ({
          threads: state.threads.map((t) => t.id === threadId ? res.data! : t),
        }));
      }
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  deleteThread: async (threadId) => {
    try {
      await apiClient.delete(`/story/threads/${threadId}`);
      set((state) => ({ threads: state.threads.filter((t) => t.id !== threadId) }));
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  clearError: () => set({ error: null }),
}));