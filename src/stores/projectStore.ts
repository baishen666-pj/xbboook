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
  setError: (error: string | null) => void;
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

    loadProjects: async () => {
      set({ isLoading: true, error: null });
      const res = await projectService.list();
      if (res.success && res.data) {
        set({ projects: res.data, isLoading: false });
      } else {
        set({ error: res.error ?? "Failed to load projects", isLoading: false });
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
      set({ error: res.error ?? "Failed to create project", isLoading: false });
      return null;
    },

    loadProjectData: async (projectId) => {
      set({ isLoading: true, error: null });

      const projectRes = await projectService.getById(projectId);
      if (!projectRes.success || !projectRes.data) {
        set({
          error: projectRes.error ?? "Failed to load project",
          isLoading: false,
        });
        return;
      }

      const chaptersRes = await chapterService.list(projectId);
      const chapters = chaptersRes.success && chaptersRes.data
        ? chaptersRes.data
        : [];

      const charsRes = await characterService.list(projectId);
      const characters = charsRes.success && charsRes.data ? charsRes.data.characters : [];
      const characterRelations = charsRes.success && charsRes.data ? charsRes.data.relations : [];

      const wvRes = await worldviewService.list(projectId);
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
      const res = await chapterService.getById(chapterId);
      if (res.success && res.data) {
        return res.data;
      }
      set({ error: res.error ?? "Failed to open chapter" });
      return null;
    },

    createChapter: async (volumeId, title) => {
      const project = get().currentProject;
      if (!project) return null;

      const res = await chapterService.create({
        projectId: project.id,
        volumeId,
        title: title ?? "New Chapter",
        sortOrder: get().chapters.length,
      });

      if (res.success && res.data) {
        const chapters = [...get().chapters, res.data];
        set({ chapters });
        return res.data;
      }

      set({ error: res.error ?? "Failed to create chapter" });
      return null;
    },

    setError: (error) => set({ error }),
  })
);
