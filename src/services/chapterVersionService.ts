import { apiClient } from './apiClient';

export const chapterVersionService = {
  list: async (projectId: string, chapterId?: string) => {
    const params = chapterId ? `?chapterId=${chapterId}` : '';
    return apiClient.get(`/projects/${projectId}/chapter-versions${params}`);
  },
  create: async (projectId: string, params: { chapterId: string; type?: string; note?: string }) => {
    return apiClient.post(`/projects/${projectId}/chapter-versions`, params);
  },
  get: async (projectId: string, id: string) => {
    return apiClient.get(`/projects/${projectId}/chapter-versions/${id}`);
  },
  diff: async (projectId: string, id1: string, id2: string) => {
    return apiClient.get(`/projects/${projectId}/chapter-versions/diff/${id1}/${id2}`);
  },
  rollback: async (projectId: string, id: string) => {
    return apiClient.post(`/projects/${projectId}/chapter-versions/${id}/rollback`, {});
  },
  delete: async (projectId: string, id: string) => {
    return apiClient.delete(`/projects/${projectId}/chapter-versions/${id}`);
  },
};
