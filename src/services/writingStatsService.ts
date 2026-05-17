import { apiClient } from './apiClient';
import type { ApiResponse } from '@/types/api';

export interface StatsOverview {
  totalWords: number;
  totalDays: number;
  avgDaily: number;
  bestDay: { date: string; words: number } | null;
  streak: number;
}

export interface TrendData {
  date: string;
  wordsAdded: number;
  wordsTotal: number;
}

export interface HeatmapData {
  hour: number;
  count: number;
}

export const writingStatsService = {
  async getOverview(projectId: string): Promise<ApiResponse<StatsOverview>> {
    return apiClient.get(`/projects/${projectId}/writing-stats/overview`);
  },
  async getTrend(projectId: string, period: 'week' | 'month' = 'week'): Promise<ApiResponse<TrendData[]>> {
    return apiClient.get(`/projects/${projectId}/writing-stats/trend?period=${period}`);
  },
  async getHeatmap(projectId: string): Promise<ApiResponse<HeatmapData[]>> {
    return apiClient.get(`/projects/${projectId}/writing-stats/heatmap`);
  },
};
