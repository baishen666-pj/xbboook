import { apiClient } from './apiClient';
import type { ApiResponse } from '@/types/api';

export interface TranslationResult {
  translated: string;
  notes: string;
  confidence: number;
}

export const translationService = {
  async translate(projectId: string, data: {
    text: string;
    targetLang: string;
    style?: 'literal' | 'free' | 'localized';
  }): Promise<ApiResponse<TranslationResult>> {
    return apiClient.post(`/projects/${projectId}/translation/translate`, data);
  },
};
