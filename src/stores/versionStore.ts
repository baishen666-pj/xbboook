import { create } from "zustand";
import type { ChapterVersion } from "@/types/project";
import { versionService } from "@/services/versionService";

interface VersionState {
  versions: ChapterVersion[];
  isLoading: boolean;
  previewVersion: ChapterVersion | null;
  compareVersionId: string | null;
}

interface VersionActions {
  loadVersions: (projectId: string, chapterId: string) => Promise<void>;
  createSnapshot: (projectId: string, chapterId: string, label?: string) => Promise<void>;
  rollback: (projectId: string, chapterId: string, versionId: string) => Promise<string | null>;
  deleteVersion: (projectId: string, chapterId: string, versionId: string) => Promise<void>;
  setPreviewVersion: (version: ChapterVersion | null) => void;
  setCompareVersionId: (id: string | null) => void;
  clear: () => void;
}

export const useVersionStore = create<VersionState & VersionActions>((set, get) => ({
  versions: [],
  isLoading: false,
  previewVersion: null,
  compareVersionId: null,

  loadVersions: async (projectId, chapterId) => {
    set({ isLoading: true });
    const res = await versionService.list(projectId, chapterId);
    set({ versions: res.success && res.data ? res.data : [], isLoading: false });
  },

  createSnapshot: async (projectId, chapterId, label) => {
    await versionService.create(projectId, chapterId, label ? { label } : undefined);
    await get().loadVersions(projectId, chapterId);
  },

  rollback: async (projectId, chapterId, versionId) => {
    const res = await versionService.rollback(projectId, chapterId, versionId);
    if (res.success && res.data) {
      await get().loadVersions(projectId, chapterId);
      return res.data.content;
    }
    return null;
  },

  deleteVersion: async (projectId, chapterId, versionId) => {
    await versionService.remove(projectId, chapterId, versionId);
    await get().loadVersions(projectId, chapterId);
  },

  setPreviewVersion: (version) => set({ previewVersion: version }),
  setCompareVersionId: (id) => set({ compareVersionId: id }),
  clear: () => set({ versions: [], previewVersion: null, compareVersionId: null, isLoading: false }),
}));
