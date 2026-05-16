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
      } else {
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
    },

    setCurrentProject: (project) => {
      set({ currentProject: project });
    },

    openChapter: async (chapterId) => {
      const project = get().currentProject;
      if (!project) return null;

      const res = await chapterService.getById(project.id, chapterId);
      if (res.success && res.data) {
        return res.data;
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
