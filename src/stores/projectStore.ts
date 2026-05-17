import { create } from "zustand";
import type {
  Project,
  Volume,
  Chapter,
  Character,
  Worldview,
  Outline,
} from "@/types/project";
import { projectService } from "@/services/projectService";
import { chapterService } from "@/services/chapterService";
import { characterService } from "@/services/characterService";
import { worldviewService } from "@/services/worldviewService";
import { offlineDb } from "@/services/offlineDb";

interface ProjectState {
  projects: Project[];
  currentProject: Project | null;
  volumes: Volume[];
  chapters: Chapter[];
  characters: Character[];
  characterRelations: import("@/types/project").CharacterRelation[];
  worldviews: Worldview[];
  worldviewCategories: string[];
  outlines: Outline[];
  isLoading: boolean;
  error: string | null;
  selectedChapterIds: string[];
}

interface ProjectActions {
  loadProjects: () => Promise<void>;
  createProject: (
    data: Pick<Project, "name" | "genre" | "description" | "writingMode">
  ) => Promise<Project | null>;
  loadProjectData: (projectId: string) => Promise<void>;
  setCurrentProject: (project: Project) => void;
  openChapter: (chapterId: string) => Promise<Chapter | null>;
  createChapter: (
    volumeId: string,
    title?: string
  ) => Promise<Chapter | null>;
  reorderChapters: (
    items: Array<{ id: string; volumeId?: string | null; sortOrder: number }>
  ) => Promise<void>;
  reorderVolumes: (
    items: Array<{ id: string; sortOrder: number }>
  ) => Promise<void>;
  setError: (error: string | null) => void;
  toggleChapterSelection: (id: string) => void;
  clearChapterSelection: () => void;
  setSelectedChapters: (ids: string[]) => void;
}

export const useProjectStore = create<ProjectState & ProjectActions>(
  (set, get) => ({
    projects: [],
    currentProject: null,
    volumes: [],
    chapters: [],
    characters: [],
    characterRelations: [],
    worldviews: [],
    worldviewCategories: [],
    outlines: [],
    isLoading: false,
    error: null,
    selectedChapterIds: [],

    loadProjects: async () => {
      set({ isLoading: true, error: null });
      const res = await projectService.list();
      if (res.success && res.data) {
        set({ projects: res.data, isLoading: false });
        Promise.all(res.data.map((p) => offlineDb.putProject(p as unknown as Record<string, unknown>))).catch(() => {});
      } else {
        if (!navigator.onLine) {
          const cached = await offlineDb.getAllProjects();
          if (cached.length > 0) {
            set({ projects: cached as unknown as Project[], isLoading: false });
            return;
          }
        }
        set({ error: res.error ?? "加载作品列表失败", isLoading: false });
      }
    },

    createProject: async (data) => {
      set({ isLoading: true, error: null });
      const res = await projectService.create(data);
      if (res.success && res.data) {
        const projects = [...get().projects, res.data];
        set({ projects, isLoading: false });
        return res.data;
      }
      set({ error: res.error ?? "创建作品失败", isLoading: false });
      return null;
    },

    loadProjectData: async (projectId) => {
      set({ isLoading: true, error: null });

      const projectRes = await projectService.getById(projectId);
      if (!projectRes.success || !projectRes.data) {
        set({
          error: projectRes.error ?? "加载作品失败",
          isLoading: false,
        });
        return;
      }

      const [chaptersRes, charsRes, wvRes] = await Promise.all([
        chapterService.list(projectId),
        characterService.list(projectId),
        worldviewService.list(projectId),
      ]);

      const chapters = chaptersRes.success && chaptersRes.data
        ? chaptersRes.data
        : [];

      const characters = charsRes.success && charsRes.data ? charsRes.data.characters : [];
      const characterRelations = charsRes.success && charsRes.data ? charsRes.data.relations : [];

      const worldviews = wvRes.success && wvRes.data ? wvRes.data.items : [];
      const worldviewCategories = wvRes.success && wvRes.data ? wvRes.data.categories : [];

      set({
        currentProject: projectRes.data,
        chapters,
        volumes: [],
        characters,
        characterRelations,
        worldviews,
        worldviewCategories,
        outlines: [],
        isLoading: false,
      });

      offlineDb.putProject(projectRes.data as unknown as Record<string, unknown>).catch(() => {});
      Promise.all(chapters.map((ch) => offlineDb.putChapter(ch as unknown as Record<string, unknown>))).catch(() => {});
      Promise.all(characters.map((c) => offlineDb.putCharacter(c as unknown as Record<string, unknown>))).catch(() => {});
      Promise.all(worldviews.map((w) => offlineDb.putWorldview(w as unknown as Record<string, unknown>))).catch(() => {});
    },

    setCurrentProject: (project) => {
      set({ currentProject: project });
    },

    openChapter: async (chapterId) => {
      const project = get().currentProject;
      if (!project) return null;

      const res = await chapterService.getById(project.id, chapterId);
      if (res.success && res.data) {
        offlineDb.putChapter(res.data as unknown as Record<string, unknown>).catch(() => {});
        return res.data;
      }
      if (!navigator.onLine) {
        const cached = await offlineDb.getChapter(chapterId);
        if (cached) return cached as unknown as Chapter;
      }
      set({ error: res.error ?? "打开章节失败" });
      return null;
    },

    createChapter: async (volumeId, title) => {
      const project = get().currentProject;
      if (!project) return null;

      const res = await chapterService.create(project.id, {
        volumeId,
        title: title ?? "新章节",
        sortOrder: get().chapters.length,
      });

      if (res.success && res.data) {
        const chapters = [...get().chapters, res.data];
        set({ chapters });
        return res.data;
      }

      set({ error: res.error ?? "创建章节失败" });
      return null;
    },

    reorderChapters: async (items) => {
      const project = get().currentProject;
      if (!project) return;

      const prevChapters = get().chapters;

      const updatedChapters = prevChapters.map((ch) => {
        const move = items.find((m) => m.id === ch.id);
        if (!move) return ch;
        return {
          ...ch,
          sortOrder: move.sortOrder,
          ...(move.volumeId !== undefined ? { volumeId: move.volumeId ?? "" } : {}),
        };
      });

      set({ chapters: updatedChapters });

      const res = await chapterService.reorder(project.id, items);
      if (!res.success) {
        set({ chapters: prevChapters, error: res.error ?? "排序失败" });
      }
    },

    reorderVolumes: async (items) => {
      const project = get().currentProject;
      if (!project) return;

      const prevVolumes = get().volumes;
      const updatedVolumes = prevVolumes.map((v) => {
        const move = items.find((m) => m.id === v.id);
        if (!move) return v;
        return { ...v, sortOrder: move.sortOrder };
      });
      set({ volumes: updatedVolumes });

      const res = await projectService.reorderVolumes(project.id, items);
      if (!res.success) {
        set({ volumes: prevVolumes, error: res.error ?? "排序失败" });
      }
    },

    setError: (error) => set({ error }),

    toggleChapterSelection: (id) => {
      const current = get().selectedChapterIds;
      const next = current.includes(id)
        ? current.filter((cid) => cid !== id)
        : [...current, id];
      set({ selectedChapterIds: next });
    },

    clearChapterSelection: () => set({ selectedChapterIds: [] }),

    setSelectedChapters: (ids) => set({ selectedChapterIds: ids }),
  })
);
