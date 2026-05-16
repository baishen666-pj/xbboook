import { apiClient } from "./apiClient";
import type { DashboardData, CharacterAppearance, WritingSession } from "@/types/project";
import type { ApiResponse } from "@/types/api";

export const analyticsService = {
  async getDashboard(projectId: string, days = 30): Promise<ApiResponse<DashboardData>> {
    return apiClient.get<DashboardData>(`/projects/${projectId}/stats/dashboard?days=${days}`);
  },

  async getTodayStats(projectId: string): Promise<ApiResponse<{
    words: number;
    durationMs: number;
    sessions: number;
    dailyTarget: number;
  }>> {
    return apiClient.get(`/projects/${projectId}/stats/today`);
  },

  async getCharacterAppearances(projectId: string): Promise<ApiResponse<CharacterAppearance[]>> {
    return apiClient.get<CharacterAppearance[]>(`/projects/${projectId}/stats/characters`);
  },

  async startSession(projectId: string, data: { chapterId: string; wordsStart: number }): Promise<ApiResponse<WritingSession>> {
    return apiClient.post<WritingSession>(`/projects/${projectId}/stats/session`, data);
  },

  async endSession(projectId: string, sessionId: string, wordsEnd: number): Promise<ApiResponse<WritingSession>> {
    return apiClient.put<WritingSession>(`/projects/${projectId}/stats/session/${sessionId}`, { wordsEnd });
  },
};
