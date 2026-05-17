import { apiClient } from './apiClient';
import type { ApiResponse } from '@/types/api';

export const bookAssetsService = {
  generateCoverPrompt: (projectId: string, data: {
    genre: string; mood?: string; keyElements?: string[]; style?: string;
  }): Promise<ApiResponse<{ prompts: { prompt: string; negative_prompt: string; parameters: Record<string, number> }[]; color_palette: string[]; composition: string }>> =>
    apiClient.post(`/projects/${projectId}/book-assets/cover-prompt`, data),

  optimizeTitle: (projectId: string, data: {
    synopsis: string; genre?: string; style?: string; count?: number;
  }): Promise<ApiResponse<{ titles: { title: string; subtitle: string; reason: string; score: number }[]; analysis: string }>> =>
    apiClient.post(`/projects/${projectId}/book-assets/title-optimize`, data),

  generateSynopsis: (projectId: string, data: {
    genre: string; chapterCount?: number; keywords?: string[]; style?: string;
  }): Promise<ApiResponse<{ synopsis: string; short_pitch: string; selling_points: string[]; tag_suggestions: string[] }>> =>
    apiClient.post(`/projects/${projectId}/book-assets/synopsis`, data),
};
