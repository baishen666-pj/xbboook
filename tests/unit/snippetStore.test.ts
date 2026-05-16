import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockFetchSnippets = vi.fn();
const mockCreateSnippet = vi.fn();
const mockUpdateSnippet = vi.fn();
const mockDeleteSnippet = vi.fn();

vi.mock('../../src/services/snippetService', () => ({
  snippetService: {
    fetchSnippets: (...args: unknown[]) => mockFetchSnippets(...args),
    createSnippet: (...args: unknown[]) => mockCreateSnippet(...args),
    updateSnippet: (...args: unknown[]) => mockUpdateSnippet(...args),
    deleteSnippet: (...args: unknown[]) => mockDeleteSnippet(...args),
  },
}));

import { useSnippetStore } from '../../src/stores/snippetStore';
import type { SnippetTemplate } from '../../src/types/project';

function makeSnippet(overrides: Partial<SnippetTemplate> = {}): SnippetTemplate {
  return {
    id: 1,
    projectId: null,
    name: '拳脚交锋',
    category: 'fight',
    content: '两人拳脚相接',
    isBuiltin: 1,
    sortOrder: 0,
    createdAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('snippetStore', () => {
  beforeEach(() => {
    useSnippetStore.setState({
      items: [],
      loading: false,
      error: null,
      searchQuery: '',
      selectedCategory: 'all',
      previewItem: null,
      editingItem: null,
      isFormOpen: false,
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('fetchSnippets', () => {
    it('fetches items and updates state', async () => {
      const items = [makeSnippet(), makeSnippet({ id: 2, name: '山川' })];
      mockFetchSnippets.mockResolvedValue({
        success: true,
        data: items,
        error: null,
      });

      await useSnippetStore.getState().fetchSnippets('proj-1');

      expect(mockFetchSnippets).toHaveBeenCalledWith('proj-1');
      expect(useSnippetStore.getState().items).toEqual(items);
      expect(useSnippetStore.getState().loading).toBe(false);
    });

    it('handles fetch failure gracefully', async () => {
      mockFetchSnippets.mockResolvedValue({
        success: false,
        data: null,
        error: 'Network error',
      });

      await useSnippetStore.getState().fetchSnippets('proj-1');

      expect(useSnippetStore.getState().items).toEqual([]);
      expect(useSnippetStore.getState().loading).toBe(false);
      expect(useSnippetStore.getState().error).toBe('Network error');
    });
  });

  describe('addSnippet', () => {
    it('adds a new item to the list', async () => {
      const newItem = makeSnippet({ id: 3, isBuiltin: 0 });
      mockCreateSnippet.mockResolvedValue({
        success: true,
        data: newItem,
        error: null,
      });

      await useSnippetStore.getState().addSnippet('proj-1', {
        name: '自定义片段',
        content: '内容',
      });

      expect(useSnippetStore.getState().items).toHaveLength(1);
      expect(useSnippetStore.getState().items[0].id).toBe(3);
      expect(useSnippetStore.getState().isFormOpen).toBe(false);
    });

    it('does not add item on failure', async () => {
      mockCreateSnippet.mockResolvedValue({
        success: false,
        data: null,
        error: 'Create failed',
      });

      await useSnippetStore.getState().addSnippet('proj-1', {
        name: 'Test',
        content: 'Content',
      });

      expect(useSnippetStore.getState().items).toHaveLength(0);
      expect(useSnippetStore.getState().error).toBe('Create failed');
    });
  });

  describe('updateSnippet', () => {
    it('updates an existing item in the list', async () => {
      const original = makeSnippet({ id: 1, isBuiltin: 0 });
      useSnippetStore.setState({ items: [original] });

      const updated = makeSnippet({ id: 1, isBuiltin: 0, name: '更新名称' });
      mockUpdateSnippet.mockResolvedValue({
        success: true,
        data: updated,
        error: null,
      });

      await useSnippetStore.getState().updateSnippet(1, { name: '更新名称' });

      expect(useSnippetStore.getState().items[0].name).toBe('更新名称');
      expect(useSnippetStore.getState().isFormOpen).toBe(false);
    });

    it('does not update on failure', async () => {
      const original = makeSnippet({ id: 1, isBuiltin: 0 });
      useSnippetStore.setState({ items: [original] });

      mockUpdateSnippet.mockResolvedValue({
        success: false,
        data: null,
        error: 'Update failed',
      });

      await useSnippetStore.getState().updateSnippet(1, { name: '失败' });

      expect(useSnippetStore.getState().items[0].name).toBe('拳脚交锋');
    });
  });

  describe('removeSnippet', () => {
    it('removes an item from the list', async () => {
      const item = makeSnippet({ id: 1, isBuiltin: 0 });
      useSnippetStore.setState({ items: [item] });

      mockDeleteSnippet.mockResolvedValue({
        success: true,
        data: null,
        error: null,
      });

      await useSnippetStore.getState().removeSnippet(1);

      expect(useSnippetStore.getState().items).toHaveLength(0);
    });

    it('does not remove on failure', async () => {
      const item = makeSnippet({ id: 1, isBuiltin: 0 });
      useSnippetStore.setState({ items: [item] });

      mockDeleteSnippet.mockResolvedValue({
        success: false,
        data: null,
        error: 'Delete failed',
      });

      await useSnippetStore.getState().removeSnippet(1);

      expect(useSnippetStore.getState().items).toHaveLength(1);
    });

    it('clears preview if deleted item was previewed', async () => {
      const item = makeSnippet({ id: 1, isBuiltin: 0 });
      useSnippetStore.setState({ items: [item], previewItem: item });

      mockDeleteSnippet.mockResolvedValue({
        success: true,
        data: null,
        error: null,
      });

      await useSnippetStore.getState().removeSnippet(1);

      expect(useSnippetStore.getState().previewItem).toBeNull();
    });
  });

  describe('UI state', () => {
    it('sets search query', () => {
      useSnippetStore.getState().setSearchQuery('打斗');
      expect(useSnippetStore.getState().searchQuery).toBe('打斗');
    });

    it('sets selected category', () => {
      useSnippetStore.getState().setSelectedCategory('fight');
      expect(useSnippetStore.getState().selectedCategory).toBe('fight');
    });

    it('sets preview item', () => {
      const item = makeSnippet();
      useSnippetStore.getState().setPreviewItem(item);
      expect(useSnippetStore.getState().previewItem).toEqual(item);
    });

    it('opens form for new item', () => {
      useSnippetStore.getState().openForm();
      expect(useSnippetStore.getState().isFormOpen).toBe(true);
      expect(useSnippetStore.getState().editingItem).toBeNull();
    });

    it('opens form for editing existing item', () => {
      const item = makeSnippet();
      useSnippetStore.getState().openForm(item);
      expect(useSnippetStore.getState().isFormOpen).toBe(true);
      expect(useSnippetStore.getState().editingItem).toEqual(item);
    });

    it('closes form and clears editing item', () => {
      const item = makeSnippet();
      useSnippetStore.setState({ isFormOpen: true, editingItem: item });
      useSnippetStore.getState().closeForm();
      expect(useSnippetStore.getState().isFormOpen).toBe(false);
      expect(useSnippetStore.getState().editingItem).toBeNull();
    });
  });
});