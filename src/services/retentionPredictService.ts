import { apiClient } from './apiClient';
import type { ApiResponse } from '@/types/api';

export const retentionPredictService = {
  predict: (projectId: string, data: {
    chapterIds?: string[]; focus?: string;
  }): Promise<ApiResponse<{
    overall_retention: { score: number; trend: string };
    chapter_analysis: { chapter: number; title: string; retention_score: number; dropoff_risk: string; risk_factors: string[]; hook_quality: number; cliffhanger_strength: number; suggestions: string[] }[];
    critical_dropoff_points: { chapter: number; risk: string; reason: string }[];
    engagement_peaks: { chapter: number; reason: string }[];
    recommendations: string[];
  }>> => apiClient.post(`/projects/${projectId}/retention-predict/predict`, data),
};
