import { apiClient } from './apiClient';
import type { ApiResponse } from '@/types/api';

export const writingCoachService = {
  coach: (projectId: string, params: {
    chapterIds?: string[];
    focusAreas?: string[];
  }): Promise<ApiResponse<any>> =>
    apiClient.post(`/projects/${projectId}/writing-coach/coach`, params),

  weakness: (projectId: string, params: {
    chapterId: string;
    severity?: string;
  }): Promise<ApiResponse<any>> =>
    apiClient.post(`/projects/${projectId}/writing-coach/weakness`, params),
};
