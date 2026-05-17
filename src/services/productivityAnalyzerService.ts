import { apiClient } from './apiClient';
import type { ApiResponse } from '@/types/api';

export interface ProductivityOverview {
  totalWords: number;
  totalChapters: number;
  avgWordsPerChapter: number;
  productivityLevel: 'high' | 'medium' | 'low';
  completionRate: number;
}

export interface ProductivityPatterns {
  peakHours: { hour: number; productivity: number }[];
  bestDay: string;
  avgSessionLength: string;
  wordsPerSession: number;
  consistencyScore: number;
}

export interface Bottleneck {
  type: string;
  description: string;
  evidence: string;
  solution: string;
}

export interface HeatmapCell {
  day: number;
  period: number;
  score: number;
}

export interface WeeklyTrendPoint {
  week: number;
  words: number;
}

export interface ProductivityRecommendation {
  category: string;
  title: string;
  description: string;
  priority: string;
  action: string;
}

export interface ProductivityGoals {
  dailyTarget: number;
  weeklyTarget: number;
  milestone: string;
  eta: string;
}

export interface ProductivityAnalysisData {
  overview: ProductivityOverview;
  patterns: ProductivityPatterns;
  bottlenecks: Bottleneck[];
  heatmapData: HeatmapCell[];
  weeklyTrend: WeeklyTrendPoint[];
  recommendations: ProductivityRecommendation[];
  goals: ProductivityGoals;
}

export const productivityAnalyzerService = {
  analyze: (projectId: string, params: {
    period?: 'week' | 'month' | 'quarter' | 'all';
  } = {}): Promise<ApiResponse<ProductivityAnalysisData>> =>
    apiClient.post(`/projects/${projectId}/productivity-analyzer/analyze`, params),
};
