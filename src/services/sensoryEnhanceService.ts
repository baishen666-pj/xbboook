import { apiClient } from './apiClient';
import type { ApiResponse } from '@/types/api';

export const sensoryEnhanceService = {
  enhance: (projectId: string, params: {
    skillId: 'sensory-expand' | 'fight-choreograph' | 'environment-builder';
    chapterId?: string;
    content?: string;
    focus?: string;
    intensity?: string;
  }): Promise<ApiResponse<any>> => {
    return apiClient.post(`/projects/${projectId}/sensory-enhance/enhance`, params);
  },
};
