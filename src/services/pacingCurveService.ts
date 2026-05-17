import { apiClient } from './apiClient';
import type { ApiResponse } from '@/types/api';

export const pacingCurveService = {
  generate: (projectId: string, params?: {
    chapterIds?: string[];
    dimensions?: string[];
  }): Promise<ApiResponse<{
    curve_data: { chapter: number; title: string; tension?: number; pace?: number; emotion?: number; info_density?: number; character_activity?: number; conflict?: number }[];
    segments: { name: string; chapters: number[]; avg_tension: number; description: string }[];
    rhythm_pattern: string;
    problem_areas: { chapter: number; issue: string; suggestion: string }[];
    peak_chapters: { chapter: number; type: string; intensity: number }[];
    overall_assessment: {
      pacing_score: number;
      balance: string;
      strength: string;
      weak: string;
      recommendations: string[];
    };
  }>> => apiClient.post(`/projects/${projectId}/pacing-curve/generate`, params || { dimensions: ['tension', 'pace', 'emotion'] }),
};
