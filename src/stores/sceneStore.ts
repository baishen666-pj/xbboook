import { create } from 'zustand';
import { sceneService } from '@/services/sceneService';
import type { SceneWithPov, SceneStats } from '@/types/project';

interface SceneState {
  scenes: SceneWithPov[];
  stats: SceneStats | null;
  isLoading: boolean;
  error: string | null;
}

interface SceneActions {
  loadScenes: (projectId: string) => Promise<void>;
  loadStats: (projectId: string) => Promise<void>;
  createScene: (projectId: string, data: { chapterId: string; title: string } & Record<string, unknown>) => Promise<boolean>;
  updateScene: (projectId: string, sceneId: string, data: Record<string, unknown>) => Promise<boolean>;
  deleteScene: (projectId: string, sceneId: string) => Promise<boolean>;
  reorderScenes: (projectId: string, sceneIds: string[]) => Promise<boolean>;
  clear: () => void;
}

export const useSceneStore = create<SceneState & SceneActions>((set, get) => ({
  scenes: [],
  stats: null,
  isLoading: false,
  error: null,

  loadScenes: async (projectId) => {
    set({ isLoading: true, error: null });
    const res = await sceneService.list(projectId);
    if (res.success && res.data) {
      set({ scenes: res.data, isLoading: false });
    } else {
      set({ error: res.error ?? '加载场景列表失败', isLoading: false });
    }
  },

  loadStats: async (projectId) => {
    const res = await sceneService.getStats(projectId);
    if (res.success && res.data) {
      set({ stats: res.data });
    }
  },

  createScene: async (projectId, data) => {
    const res = await sceneService.create(projectId, data);
    if (res.success && res.data) {
      set({ scenes: [...get().scenes, res.data as unknown as SceneWithPov] });
      return true;
    }
    set({ error: res.error ?? '创建场景失败' });
    return false;
  },

  updateScene: async (projectId, sceneId, data) => {
    const res = await sceneService.update(projectId, sceneId, data);
    if (res.success && res.data) {
      set({
        scenes: get().scenes.map((s) =>
          s.id === sceneId ? (res.data as unknown as SceneWithPov) : s
        ),
      });
      return true;
    }
    set({ error: res.error ?? '更新场景失败' });
    return false;
  },

  deleteScene: async (projectId, sceneId) => {
    const res = await sceneService.remove(projectId, sceneId);
    if (res.success) {
      set({ scenes: get().scenes.filter((s) => s.id !== sceneId) });
      return true;
    }
    set({ error: res.error ?? '删除场景失败' });
    return false;
  },

  reorderScenes: async (projectId, sceneIds) => {
    const original = [...get().scenes];
    const reordered = sceneIds
      .map((id) => original.find((s) => s.id === id))
      .filter(Boolean) as SceneWithPov[];
    set({ scenes: reordered });

    const res = await sceneService.reorder(projectId, sceneIds);
    if (!res.success) {
      set({ scenes: original, error: res.error ?? '排序失败' });
      return false;
    }
    return true;
  },

  clear: () => set({ scenes: [], stats: null, error: null }),
}));
