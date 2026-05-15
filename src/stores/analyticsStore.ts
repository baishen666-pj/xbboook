import { create } from "zustand";
import { analyticsService } from "@/services/analyticsService";
import type { DashboardData, CharacterAppearance } from "@/types/project";

interface AnalyticsState {
  dashboard: DashboardData | null;
  characters: CharacterAppearance[];
  loading: boolean;
  error: string | null;
  fetchDashboard: (projectId: string, days?: number) => Promise<void>;
  fetchCharacters: (projectId: string) => Promise<void>;
}

export const useAnalyticsStore = create<AnalyticsState>((set) => ({
  dashboard: null,
  characters: [],
  loading: false,
  error: null,

  fetchDashboard: async (projectId, days = 30) => {
    set({ loading: true, error: null });
    const res = await analyticsService.getDashboard(projectId, days);
    if (res.success && res.data) {
      set({ dashboard: res.data, loading: false });
    } else {
      set({ error: res.error ?? "加载失败", loading: false });
    }
  },

  fetchCharacters: async (projectId) => {
    const res = await analyticsService.getCharacterAppearances(projectId);
    if (res.success && res.data) {
      set({ characters: res.data });
    }
  },
}));
