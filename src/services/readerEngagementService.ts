import { apiClient } from './apiClient';
import type { ApiResponse } from '@/types/api';

export const readerEngagementService = {
  predict: (projectId: string, chapterIds?: string[]): Promise<ApiResponse<any>> =>
    apiClient.post(`/projects/${projectId}/reader-engagement/predict`, { chapterIds }),

  hookScore: (projectId: string, chapterId: string): Promise<ApiResponse<any>> =>
    apiClient.post(`/projects/${projectId}/reader-engagement/hook-score`, { chapterId }),
};
