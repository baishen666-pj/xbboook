import { create } from 'zustand';
import type { Foreshadowing } from '../types/project';
import { foreshadowingService } from '../services/foreshadowingService';

interface ForeshadowingState {
  items: Foreshadowing[];
  loading: boolean;
}

interface ForeshadowingActions {
  fetchForeshadowing: (projectId: string, status?: string) => Promise<void>;
  addForeshadowing: (
    projectId: string,
    data: {
      title: string;
      description?: string;
      plant_chapter_id?: string;
      expected_harvest_chapter_id?: string;
      importance?: string;
    },
  ) => Promise<void>;
  updateForeshadowing: (
    projectId: string,
    id: string,
    data: Partial<{
      title: string;
      description: string | null;
      plant_chapter_id: string | null;
      expected_harvest_chapter_id: string | null;
      actual_harvest_chapter_id: string | null;
      status: string;
      importance: string;
    }>,
  ) => Promise<void>;
  removeForeshadowing: (projectId: string, id: string) => Promise<void>;
  clear: () => void;
}

export const useForeshadowingStore = create<ForeshadowingState & ForeshadowingActions>(
  (set) => ({
    items: [],
    loading: false,

    fetchForeshadowing: async (projectId, status) => {
      set({ loading: true });
      const res = await foreshadowingService.fetchForeshadowing(projectId, status);
      if (res.success && res.data) {
        set({ items: res.data, loading: false });
      } else {
        set({ loading: false });
      }
    },

    addForeshadowing: async (projectId, data) => {
      const res = await foreshadowingService.createForeshadowing(projectId, data);
      if (res.success && res.data) {
        set((state) => ({ items: [...state.items, res.data!] }));
      }
    },

    updateForeshadowing: async (projectId, id, data) => {
      const res = await foreshadowingService.updateForeshadowing(projectId, id, data);
      if (res.success && res.data) {
        set((state) => ({
          items: state.items.map((item) =>
            item.id === id ? res.data! : item,
          ),
        }));
      }
    },

    removeForeshadowing: async (projectId, id) => {
      const res = await foreshadowingService.deleteForeshadowing(projectId, id);
      if (res.success) {
        set((state) => ({
          items: state.items.filter((item) => item.id !== id),
        }));
      }
    },

    clear: () => set({ items: [], loading: false }),
  }),
);