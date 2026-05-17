import { apiClient } from './apiClient';
import type { ApiResponse } from '@/types/api';

export const coherenceEngineService = {
  check: (projectId: string, data: {
    scope?: string; volumeStart?: number; volumeEnd?: number;
    checks?: string[];
  }): Promise<ApiResponse<{
    overall_coherence: number;
    checks: { type: string; score: number; issues: { severity: string; description: string; chapters: number[]; suggestion: string }[] }[];
    foreshadowing_status: { planted_but_unresolved: string[]; resolved_well: string[]; orphaned: string[] };
    cross_volume_issues: string[];
    recommendations: string[];
  }>> => apiClient.post(`/projects/${projectId}/coherence/check`, data),
};
