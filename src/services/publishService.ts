import { apiClient } from './apiClient';

export interface PublishTarget {
  id: string;
  projectId: string;
  name: string;
  platform: string;
  platformLabel?: string;
  config: string;
  lastPublishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Platform {
  value: string;
  label: string;
}

export const publishService = {
  list(projectId: string) {
    return apiClient.get<PublishTarget[]>(`/projects/${projectId}/publish`);
  },

  platforms() {
    return apiClient.get<Platform[]>('/projects/dummy/publish/platforms');
  },

  create(projectId: string, data: { name: string; platform: string; config?: string }) {
    return apiClient.post<PublishTarget>(`/projects/${projectId}/publish`, data);
  },

  update(projectId: string, targetId: string, data: Partial<{ name: string; platform: string; config: string }>) {
    return apiClient.patch<PublishTarget>(`/projects/${projectId}/publish/${targetId}`, data);
  },

  delete(projectId: string, targetId: string) {
    return apiClient.delete(`/projects/${projectId}/publish/${targetId}`);
  },

  export(projectId: string, targetId: string, chapterIds?: string[]) {
    return apiClient.post<{
      exportUrl: string;
      chapterCount: number;
      totalWords: number;
      platformLabel: string;
    }>(`/projects/${projectId}/publish/${targetId}/export`, { chapterIds });
  },
};
