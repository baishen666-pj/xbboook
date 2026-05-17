import { apiClient } from './apiClient';
import type { ApiResponse } from '@/types/api';

export const dialogueConsistencyService = {
  check: (projectId: string, params: {
    chapterIds?: string[];
    characterNames?: string[];
  }): Promise<ApiResponse<any>> => {
    return apiClient.post(`/projects/${projectId}/dialogue-consistency/check`, params);
  },
  voiceProfile: (projectId: string, params: {
    characterName: string;
    chapterIds?: string[];
  }): Promise<ApiResponse<any>> => {
    return apiClient.post(`/projects/${projectId}/dialogue-consistency/voice-profile`, params);
  },
};
