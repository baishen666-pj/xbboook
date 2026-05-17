import { apiClient } from './apiClient';
import type { ApiResponse } from '@/types/api';

export const characterProfileService = {
  analyze: (projectId: string, data: {
    characterId: string; depth?: string;
  }): Promise<ApiResponse<{
    mbti: { type: string; confidence: number; dimensions: Record<string, number>; explanation: string };
    enneagram: { type: string; wing: string; explanation: string };
    big_five: Record<string, number>;
    motivations: string[]; fears: string[]; values: string[];
    communication_style: string; conflict_style: string;
    growth_potential: number; story_role: string;
  }>> => apiClient.post(`/projects/${projectId}/character-profile/profile`, data),

  planArc: (projectId: string, data: {
    characterId: string; arcType?: string; targetChapters?: number;
  }): Promise<ApiResponse<{
    arc_type: string;
    start_state: { belief: string; want: string; need: string; flaw: string };
    end_state: { belief: string; resolution: string };
    milestones: { phase: string; chapters: number[]; event: string; internal_change: string; external_change: string }[];
    key_scenes: string[]; pitfalls: string[];
  }>> => apiClient.post(`/projects/${projectId}/character-profile/arc-plan`, data),
};
