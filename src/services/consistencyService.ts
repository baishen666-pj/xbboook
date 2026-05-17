import { apiClient } from './apiClient';
import type { ConsistencyIssue } from '../types/project';

interface Counts {
  open: number;
  acknowledged: number;
  fixed: number;
  dismissed: number;
}

export const consistencyService = {
  async list(projectId: string, status?: string) {
    const query = status ? `?status=${status}` : '';
    return apiClient.get<ConsistencyIssue[]>(`/consistency/${projectId}${query}`);
  },

  async counts(projectId: string) {
    return apiClient.get<Counts>(`/consistency/${projectId}/counts`);
  },

  async create(projectId: string, data: Partial<ConsistencyIssue>) {
    return apiClient.post<ConsistencyIssue>(`/consistency/${projectId}`, data);
  },

  async update(projectId: string, id: string, data: Partial<ConsistencyIssue>) {
    return apiClient.put<ConsistencyIssue>(`/consistency/${projectId}/${id}`, data);
  },

  async remove(projectId: string, id: string) {
    return apiClient.delete(`/consistency/${projectId}/${id}`);
  },

  async bulkCreate(projectId: string, issues: Partial<ConsistencyIssue>[]) {
    return apiClient.post<{ count: number }>(`/consistency/${projectId}/bulk`, { issues });
  },

  async scanNames(projectId: string, chapterIds?: string[]) {
    return apiClient.post<{ issuesFound: number; saved: number }>(`/consistency/${projectId}/scan-names`, { chapterIds });
  },
};
