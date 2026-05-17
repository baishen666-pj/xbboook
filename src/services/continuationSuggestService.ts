import { apiClient } from './apiClient';
import type { ApiResponse } from '@/types/api';

export interface ContinuationSuggestion {
  direction: string;
  content: string;
  confidence: number;
}

export const continuationSuggestService = {
  async suggest(projectId: string, text: string, numSuggestions: number = 3): Promise<ApiResponse<{ suggestions: ContinuationSuggestion[] }>> {
    return apiClient.post(`/projects/${projectId}/continuation-suggest/suggest`, { text, numSuggestions });
  },
};
