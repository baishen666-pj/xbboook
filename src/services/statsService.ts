import { apiClient } from "./apiClient";
import type { DailyStat, StatsSummary } from "@/types/project";
import type { ApiResponse } from "@/types/api";

interface StatsResponse {
  summary: StatsSummary;
  recent: DailyStat[];
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
};
