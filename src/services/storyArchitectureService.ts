import { apiClient } from './apiClient';
import type { ApiResponse } from '@/types/api';

export const storyArchitectureService = {
  analyze: (projectId: string, data: {
    structure?: string; chapters?: string[];
  }): Promise<ApiResponse<{
    structure: { name: string; acts: { name: string; chapters: number[]; summary: string; key_events: string[]; pacing: string; completeness: number }[] };
    pacing_curve: { chapter: number; intensity: number }[];
    suggestions: string[]; overall_score: number;
  }>> => apiClient.post(`/projects/${projectId}/story-architecture/analyze`, data),

  getPacing: (projectId: string, data: {
    chapterIds?: string[]; windowSize?: number;
  }): Promise<ApiResponse<{ pacing: { chapter: number; title: string; wordCount: number; intensity: number; smoothedIntensity: number }[]; totalChapters: number }>> =>
    apiClient.post(`/projects/${projectId}/story-architecture/pacing`, data),
};
