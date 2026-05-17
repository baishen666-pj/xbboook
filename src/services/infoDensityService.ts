import { apiClient } from './apiClient';
import type { ApiResponse } from '@/types/api';

export const infoDensityService = {
  analyze: (projectId: string, params: {
    chapterIds?: string[];
  }): Promise<ApiResponse<any>> => {
    return apiClient.post(`/projects/${projectId}/info-density/analyze`, params);
  },
};
