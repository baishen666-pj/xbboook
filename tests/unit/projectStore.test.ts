/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/services/projectService', () => ({
  projectService: { list: vi.fn(), create: vi.fn(), getById: vi.fn() },
}));

vi.mock('@/services/chapterService', () => ({
  chapterService: { list: vi.fn(), getById: vi.fn(), create: vi.fn() },
}));

vi.mock('@/services/characterService', () => ({
  characterService: { list: vi.fn() },
}));

vi.mock('@/services/worldviewService', () => ({
  worldviewService: { list: vi.fn() },
}));

import { useProjectStore } from '@/stores/projectStore';
import { projectService } from '@/services/projectService';
import { chapterService } from '@/services/chapterService';
import { characterService } from '@/services/characterService';
import { worldviewService } from '@/services/worldviewService';

const mockProjectService = projectService as unknown as {
  list: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  getById: ReturnType<typeof vi.fn>;
};
const mockChapterService = chapterService as unknown as {
  list: ReturnType<typeof vi.fn>;
  getById: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
};
const mockCharacterService = characterService as unknown as {
  list: ReturnType<typeof vi.fn>;
};
const mockWorldviewService = worldviewService as unknown as {
  list: ReturnType<typeof vi.fn>;
};

const fakeProject = {
  id: 'p1',
  name: 'Test Novel',
  genre: 'fantasy',
  description: 'A test',
  writingMode: 'webnovel',
  status: 'active',
  sortOrder: 0,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const initialState = {
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
};

describe('projectStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useProjectStore.setState(initialState);
  });

  describe('initial state', () => {
    it('starts with empty data and no errors', () => {
      const state = useProjectStore.getState();
      expect(state.projects).toEqual([]);
      expect(state.currentProject).toBeNull();
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe('loadProjects', () => {
    it('loads projects on success', async () => {
      mockProjectService.list.mockResolvedValue({
        success: true,
        data: [fakeProject],
        error: null,
      });

      await useProjectStore.getState().loadProjects();

      expect(useProjectStore.getState().projects).toEqual([fakeProject]);
      expect(useProjectStore.getState().isLoading).toBe(false);
      expect(useProjectStore.getState().error).toBeNull();
    });

    it('sets isLoading during fetch then false after', async () => {
      let loadingDuringFetch = false;
      mockProjectService.list.mockImplementation(async () => {
        loadingDuringFetch = useProjectStore.getState().isLoading;
        return { success: true, data: [], error: null };
      });

      await useProjectStore.getState().loadProjects();

      expect(loadingDuringFetch).toBe(true);
      expect(useProjectStore.getState().isLoading).toBe(false);
    });

    it('sets error on failure', async () => {
      mockProjectService.list.mockResolvedValue({
        success: false,
        data: null,
        error: 'Server error',
      });

      await useProjectStore.getState().loadProjects();

      expect(useProjectStore.getState().error).toBe('Server error');
      expect(useProjectStore.getState().isLoading).toBe(false);
    });

    it('sets default error message when error is null', async () => {
      mockProjectService.list.mockResolvedValue({
        success: false,
        data: null,
        error: null,
      });

      await useProjectStore.getState().loadProjects();

      expect(useProjectStore.getState().error).toBeTruthy();
    });
  });

  describe('createProject', () => {
    it('creates a project and appends to list', async () => {
      useProjectStore.setState({ projects: [fakeProject] });

      const newProject = { ...fakeProject, id: 'p2', name: 'Novel 2' };
      mockProjectService.create.mockResolvedValue({
        success: true,
        data: newProject,
        error: null,
      });

      const result = await useProjectStore.getState().createProject({
        name: 'Novel 2',
        genre: 'scifi',
        description: '',
        writingMode: 'webnovel',
      });

      expect(result).toEqual(newProject);
      expect(useProjectStore.getState().projects).toHaveLength(2);
      expect(useProjectStore.getState().projects[1].id).toBe('p2');
    });

    it('returns null and sets error on failure', async () => {
      mockProjectService.create.mockResolvedValue({
        success: false,
        data: null,
        error: 'Create failed',
      });

      const result = await useProjectStore.getState().createProject({
        name: 'Fail',
        genre: 'fantasy',
        description: '',
        writingMode: 'webnovel',
      });

      expect(result).toBeNull();
      expect(useProjectStore.getState().error).toBe('Create failed');
    });

    it('preserves existing projects when creating new one', async () => {
      useProjectStore.setState({ projects: [fakeProject] });
      const newProject = { ...fakeProject, id: 'p2' };
      mockProjectService.create.mockResolvedValue({
        success: true,
        data: newProject,
        error: null,
      });

      await useProjectStore.getState().createProject({
        name: 'X',
        genre: 'fantasy',
        description: '',
        writingMode: 'webnovel',
      });

      const projects = useProjectStore.getState().projects;
      expect(projects[0].id).toBe('p1');
      expect(projects[1].id).toBe('p2');
    });
  });

  describe('loadProjectData', () => {
    it('loads project with chapters, characters, and worldviews', async () => {
      mockProjectService.getById.mockResolvedValue({
        success: true,
        data: fakeProject,
        error: null,
      });

      mockChapterService.list.mockResolvedValue({
        success: true,
        data: [{ id: 'ch1', title: 'Chapter 1' }],
        error: null,
      });

      mockCharacterService.list.mockResolvedValue({
        success: true,
        data: {
          characters: [{ id: 'char1', name: 'Alice' }],
          relations: [{ id: 'rel1', relationType: 'friend' }],
        },
        error: null,
      });

      mockWorldviewService.list.mockResolvedValue({
        success: true,
        data: {
          items: [{ id: 'wv1', title: 'Geography' }],
          categories: ['geography', 'magic'],
        },
        error: null,
      });

      await useProjectStore.getState().loadProjectData('p1');

      const state = useProjectStore.getState();
      expect(state.currentProject).toEqual(fakeProject);
      expect(state.chapters).toHaveLength(1);
      expect(state.characters).toHaveLength(1);
      expect(state.characterRelations).toHaveLength(1);
      expect(state.worldviews).toHaveLength(1);
      expect(state.worldviewCategories).toEqual(['geography', 'magic']);
      expect(state.isLoading).toBe(false);
    });

    it('sets error when project fetch fails', async () => {
      mockProjectService.getById.mockResolvedValue({
        success: false,
        data: null,
        error: 'Not found',
      });

      await useProjectStore.getState().loadProjectData('bad-id');

      expect(useProjectStore.getState().error).toBe('Not found');
      expect(useProjectStore.getState().isLoading).toBe(false);
    });

    it('handles partial service failures gracefully', async () => {
      mockProjectService.getById.mockResolvedValue({
        success: true,
        data: fakeProject,
        error: null,
      });

      mockChapterService.list.mockResolvedValue({
        success: false,
        data: null,
        error: 'Error',
      });

      mockCharacterService.list.mockResolvedValue({
        success: false,
        data: null,
        error: 'Error',
      });

      mockWorldviewService.list.mockResolvedValue({
        success: false,
        data: null,
        error: 'Error',
      });

      await useProjectStore.getState().loadProjectData('p1');

      const state = useProjectStore.getState();
      expect(state.currentProject).toEqual(fakeProject);
      expect(state.chapters).toEqual([]);
      expect(state.characters).toEqual([]);
      expect(state.worldviews).toEqual([]);
      expect(state.worldviewCategories).toEqual([]);
    });
  });

  describe('setCurrentProject', () => {
    it('sets the current project', () => {
      useProjectStore.getState().setCurrentProject(fakeProject);

      expect(useProjectStore.getState().currentProject).toEqual(fakeProject);
    });

    it('can clear current project with null', () => {
      useProjectStore.getState().setCurrentProject(fakeProject);
      useProjectStore.getState().setCurrentProject(null);

      expect(useProjectStore.getState().currentProject).toBeNull();
    });
  });

  describe('openChapter', () => {
    it('returns chapter data on success', async () => {
      useProjectStore.setState({ currentProject: fakeProject });
      const chapterData = { id: 'ch1', title: 'Chapter 1', content: 'Hello world' };

      mockChapterService.getById.mockResolvedValue({
        success: true,
        data: chapterData,
        error: null,
      });

      const result = await useProjectStore.getState().openChapter('ch1');

      expect(result).toEqual(chapterData);
    });

    it('returns null when no current project', async () => {
      useProjectStore.setState({ currentProject: null });

      const result = await useProjectStore.getState().openChapter('ch1');

      expect(result).toBeNull();
    });

    it('sets error on failure', async () => {
      useProjectStore.setState({ currentProject: fakeProject });
      mockChapterService.getById.mockResolvedValue({
        success: false,
        data: null,
        error: 'Chapter not found',
      });

      const result = await useProjectStore.getState().openChapter('bad-id');

      expect(result).toBeNull();
      expect(useProjectStore.getState().error).toBe('Chapter not found');
    });
  });

  describe('createChapter', () => {
    it('creates a chapter and appends to list', async () => {
      useProjectStore.setState({ currentProject: fakeProject, chapters: [] });
      const newChapter = { id: 'ch1', title: 'New Chapter' };

      mockChapterService.create.mockResolvedValue({
        success: true,
        data: newChapter,
        error: null,
      });

      const result = await useProjectStore.getState().createChapter('vol1', 'New Chapter');

      expect(result).toEqual(newChapter);
      expect(useProjectStore.getState().chapters).toHaveLength(1);
      expect(mockChapterService.create).toHaveBeenCalledWith('p1', {
        volumeId: 'vol1',
        title: 'New Chapter',
        sortOrder: 0,
      });
    });

    it('uses default title when not provided', async () => {
      useProjectStore.setState({ currentProject: fakeProject, chapters: [] });
      mockChapterService.create.mockResolvedValue({
        success: true,
        data: { id: 'ch1', title: '新章节' },
        error: null,
      });

      await useProjectStore.getState().createChapter('vol1');

      expect(mockChapterService.create).toHaveBeenCalledWith('p1', {
        volumeId: 'vol1',
        title: '新章节',
        sortOrder: 0,
      });
    });

    it('returns null when no current project', async () => {
      useProjectStore.setState({ currentProject: null });

      const result = await useProjectStore.getState().createChapter('vol1');

      expect(result).toBeNull();
    });

    it('sets error on failure', async () => {
      useProjectStore.setState({ currentProject: fakeProject, chapters: [] });
      mockChapterService.create.mockResolvedValue({
        success: false,
        data: null,
        error: 'Create failed',
      });

      const result = await useProjectStore.getState().createChapter('vol1', 'Test');

      expect(result).toBeNull();
      expect(useProjectStore.getState().error).toBe('Create failed');
    });

    it('uses current chapters length as sortOrder', async () => {
      useProjectStore.setState({
        currentProject: fakeProject,
        chapters: [{ id: 'ch1' }, { id: 'ch2' }],
      });

      mockChapterService.create.mockResolvedValue({
        success: true,
        data: { id: 'ch3', title: 'Third' },
        error: null,
      });

      await useProjectStore.getState().createChapter('vol1', 'Third');

      expect(mockChapterService.create).toHaveBeenCalledWith('p1', {
        volumeId: 'vol1',
        title: 'Third',
        sortOrder: 2,
      });
    });
  });

  describe('setError', () => {
    it('sets an error message', () => {
      useProjectStore.getState().setError('Something went wrong');
      expect(useProjectStore.getState().error).toBe('Something went wrong');
    });

    it('clears error with null', () => {
      useProjectStore.getState().setError('Error');
      useProjectStore.getState().setError(null);
      expect(useProjectStore.getState().error).toBeNull();
    });
  });
});
