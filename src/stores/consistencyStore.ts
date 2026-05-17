import { create } from 'zustand';
import type { ConsistencyIssue } from '../types/project';
import { consistencyService } from '../services/consistencyService';

interface ConsistencyState {
  issues: ConsistencyIssue[];
  counts: { open: number; acknowledged: number; fixed: number; dismissed: number };
  loading: boolean;
}

interface ConsistencyActions {
  fetchIssues: (projectId: string, status?: string) => Promise<void>;
  fetchCounts: (projectId: string) => Promise<void>;
  updateIssue: (projectId: string, id: string, data: Partial<ConsistencyIssue>) => Promise<void>;
  deleteIssue: (projectId: string, id: string) => Promise<void>;
  bulkCreate: (projectId: string, issues: Partial<ConsistencyIssue>[]) => Promise<void>;
  scanNames: (projectId: string) => Promise<void>;
  clear: () => void;
}

export const useConsistencyStore = create<ConsistencyState & ConsistencyActions>(
  (set, get) => ({
    issues: [],
    counts: { open: 0, acknowledged: 0, fixed: 0, dismissed: 0 },
    loading: false,

    fetchIssues: async (projectId, status) => {
      set({ loading: true });
      const res = await consistencyService.list(projectId, status);
      if (res.success && res.data) {
        set({ issues: res.data, loading: false });
      } else {
        set({ loading: false });
      }
    },

    fetchCounts: async (projectId) => {
      const res = await consistencyService.counts(projectId);
      if (res.success && res.data) {
        set({ counts: res.data });
      }
    },

    updateIssue: async (projectId, id, data) => {
      const res = await consistencyService.update(projectId, id, data);
      if (res.success && res.data) {
        set((s) => ({
          issues: s.issues.map((i) => i.id === id ? res.data! : i),
        }));
        get().fetchCounts(projectId);
      }
    },

    deleteIssue: async (projectId, id) => {
      const res = await consistencyService.remove(projectId, id);
      if (res.success) {
        set((s) => ({
          issues: s.issues.filter((i) => i.id !== id),
        }));
        get().fetchCounts(projectId);
      }
    },

    bulkCreate: async (projectId, issues) => {
      const res = await consistencyService.bulkCreate(projectId, issues);
      if (res.success) {
        get().fetchIssues(projectId);
        get().fetchCounts(projectId);
      }
    },

    scanNames: async (projectId) => {
      await consistencyService.scanNames(projectId);
      get().fetchIssues(projectId);
      get().fetchCounts(projectId);
    },

    clear: () => set({ issues: [], counts: { open: 0, acknowledged: 0, fixed: 0, dismissed: 0 }, loading: false }),
  }),
);
