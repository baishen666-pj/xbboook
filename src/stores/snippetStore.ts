import { create } from 'zustand';
import { snippetService } from '../services/snippetService';
import type { SnippetTemplate, SnippetCategory } from '../types/project';

interface SnippetState {
  items: SnippetTemplate[];
  loading: boolean;
  error: string | null;
  searchQuery: string;
  selectedCategory: SnippetCategory | 'all';
  previewItem: SnippetTemplate | null;
  editingItem: SnippetTemplate | null;
  isFormOpen: boolean;

  fetchSnippets: (projectId: string) => Promise<void>;
  addSnippet: (projectId: string, data: { name: string; category?: string; content: string }) => Promise<void>;
  updateSnippet: (id: number, data: Partial<{ name: string; category: string; content: string; sort_order: number }>) => Promise<void>;
  removeSnippet: (id: number) => Promise<void>;
  setSearchQuery: (query: string) => void;
  setSelectedCategory: (category: SnippetCategory | 'all') => void;
  setPreviewItem: (item: SnippetTemplate | null) => void;
  openForm: (item?: SnippetTemplate) => void;
  closeForm: () => void;
}

export const useSnippetStore = create<SnippetState>((set, get) => ({
  items: [],
  loading: false,
  error: null,
  searchQuery: '',
  selectedCategory: 'all',
  previewItem: null,
  editingItem: null,
  isFormOpen: false,

  fetchSnippets: async (projectId: string) => {
    set({ loading: true, error: null });
    try {
      const response = await snippetService.fetchSnippets(projectId);
      if (response.data) {
        set({ items: response.data, loading: false });
      } else {
        set({ error: response.error ?? '获取片段模板失败', loading: false });
      }
    } catch (err) {
      set({ error: String(err), loading: false });
    }
  },

  addSnippet: async (projectId, data) => {
    set({ error: null });
    try {
      const response = await snippetService.createSnippet(projectId, data);
      if (response.data) {
        const currentItems = get().items;
        set({ items: [...currentItems, response.data], isFormOpen: false, editingItem: null });
      } else {
        set({ error: response.error ?? '创建模板失败' });
      }
    } catch (err) {
      set({ error: String(err) });
    }
  },

  updateSnippet: async (id, data) => {
    set({ error: null });
    try {
      const response = await snippetService.updateSnippet(id, data);
      if (response.data) {
        const updatedItems = get().items.map((item) =>
          item.id === id ? response.data! : item,
        );
        set({ items: updatedItems, isFormOpen: false, editingItem: null, previewItem: response.data });
      } else {
        set({ error: response.error ?? '更新模板失败' });
      }
    } catch (err) {
      set({ error: String(err) });
    }
  },

  removeSnippet: async (id) => {
    set({ error: null });
    try {
      const response = await snippetService.deleteSnippet(id);
      if (response.error) {
        set({ error: response.error });
        return;
      }
      const updatedItems = get().items.filter((item) => item.id !== id);
      const currentPreview = get().previewItem;
      set({
        items: updatedItems,
        previewItem: currentPreview?.id === id ? null : currentPreview,
      });
    } catch (err) {
      set({ error: String(err) });
    }
  },

  setSearchQuery: (query) => set({ searchQuery: query }),
  setSelectedCategory: (category) => set({ selectedCategory: category }),
  setPreviewItem: (item) => set({ previewItem: item }),

  openForm: (item) => {
    if (item) {
      set({ editingItem: item, isFormOpen: true });
    } else {
      set({ editingItem: null, isFormOpen: true });
    }
  },

  closeForm: () => set({ isFormOpen: false, editingItem: null }),
}));