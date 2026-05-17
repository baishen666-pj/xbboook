import { apiClient } from "./apiClient";
import type { DailyStat, StatsSummary } from "@/types/project";
import type { ApiResponse } from "@/types/api";

interface StatsResponse {
  summary: StatsSummary;
  recent: DailyStat[];
}

export interface WritingSession {
  id: string;
  projectId: string;
  chapterId: string;
  chapterTitle: string;
  startedAt: string;
  endedAt: string | null;
  wordsStart: number;
  wordsEnd: number;
  wordsDelta: number;
  durationMs: number;
}

export const statsService = {
  async getStats(projectId: string): Promise<ApiResponse<StatsResponse>> {
    return apiClient.get<StatsResponse>(`/projects/${projectId}/stats`);
  },

  async record(projectId: string, data: {
    date: string;
    wordsAdded: number;
    wordsTotal: number;
    writingTimeMs?: number;
    chaptersWorked?: number;
  }): Promise<ApiResponse<DailyStat>> {
    return apiClient.post<DailyStat>(`/projects/${projectId}/stats`, data);
  },

  async getSessions(projectId: string, limit = 20): Promise<ApiResponse<WritingSession[]>> {
    return apiClient.get<WritingSession[]>(`/projects/${projectId}/stats/sessions?limit=${limit}`);
  },
};
