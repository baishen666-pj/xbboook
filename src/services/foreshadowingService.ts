import { apiClient } from './apiClient';
import type { Foreshadowing } from '../types/project';
import type { ApiResponse } from '../types/api';

export const foreshadowingService = {
  async fetchForeshadowing(
    projectId: string,
    status?: string,
  ): Promise<ApiResponse<Foreshadowing[]>> {
    const params = status ? `?status=${status}` : '';
    return apiClient.get<Foreshadowing[]>(`/foreshadowing/${projectId}${params}`);
  },

  async createForeshadowing(
    projectId: string,
    data: {
      title: string;
      description?: string;
      plant_chapter_id?: string;
      expected_harvest_chapter_id?: string;
      importance?: string;
    },
  ): Promise<ApiResponse<Foreshadowing>> {
    return apiClient.post<Foreshadowing>(`/foreshadowing/${projectId}`, data);
  },

  async updateForeshadowing(
    projectId: string,
    id: string,
    data: Partial<{
      title: string;
      description: string | null;
      plant_chapter_id: string | null;
      expected_harvest_chapter_id: string | null;
      actual_harvest_chapter_id: string | null;
      status: string;
      importance: string;
    }>,
  ): Promise<ApiResponse<Foreshadowing>> {
    return apiClient.patch<Foreshadowing>(`/foreshadowing/${projectId}/${id}`, data);
  },

  async deleteForeshadowing(
    projectId: string,
    id: string,
  ): Promise<ApiResponse<null>> {
    return apiClient.delete<null>(`/foreshadowing/${projectId}/${id}`);
  },
};