import { apiClient } from './apiClient';
import type { ApiResponse } from '@/types/api';

export interface ReaderFeedback {
  readerType: string;
  reaction: string;
  score: number;
  comment: string;
  suggestions: string[];
}

export const readerFeedbackService = {
  async simulate(projectId: string, data: {
    text: string;
    readerTypes: string[];
  }): Promise<ApiResponse<{ feedbacks: ReaderFeedback[] }>> {
    return apiClient.post(`/projects/${projectId}/reader-feedback/simulate`, data);
  },
};
