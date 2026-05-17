import { apiClient } from './apiClient';
import type { Scene, SceneWithPov, SceneStats } from '@/types/project';
import type { ApiResponse } from '@/types/api';

export const sceneService = {
  async list(projectId: string): Promise<ApiResponse<SceneWithPov[]>> {
    return apiClient.get<SceneWithPov[]>(`/projects/${projectId}/scenes`);
  },

  async listByChapter(projectId: string, chapterId: string): Promise<ApiResponse<Scene[]>> {
    return apiClient.get<Scene[]>(`/projects/${projectId}/scenes/chapter/${chapterId}`);
  },

  async getStats(projectId: string): Promise<ApiResponse<SceneStats>> {
    return apiClient.get<SceneStats>(`/projects/${projectId}/scenes/stats`);
  },

  async getById(projectId: string, sceneId: string): Promise<ApiResponse<SceneWithPov>> {
    return apiClient.get<SceneWithPov>(`/projects/${projectId}/scenes/${sceneId}`);
  },

  async create(projectId: string, data: Partial<Scene> & { chapterId: string; title: string }): Promise<ApiResponse<Scene>> {
    return apiClient.post<Scene>(`/projects/${projectId}/scenes`, data);
  },

  async update(projectId: string, sceneId: string, data: Partial<Scene>): Promise<ApiResponse<Scene>> {
    return apiClient.put<Scene>(`/projects/${projectId}/scenes/${sceneId}`, data);
  },

  async remove(projectId: string, sceneId: string): Promise<ApiResponse<null>> {
    return apiClient.delete(`/projects/${projectId}/scenes/${sceneId}`);
  },

  async reorder(projectId: string, sceneIds: string[]): Promise<ApiResponse<null>> {
    return apiClient.post(`/projects/${projectId}/scenes/reorder`, { sceneIds });
  },
};
