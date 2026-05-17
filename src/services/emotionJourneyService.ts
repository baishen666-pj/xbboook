import { apiClient } from './apiClient';
import type { ApiResponse } from '@/types/api';

export interface EmotionJourneyData {
  chapter: number;
  title: string;
  dominantEmotion: string;
  emotions: Record<string, number>;
  emotionalPeak: string;
  transitionType: string;
}

export interface EmotionArc {
  pattern: string;
  effectiveness: number;
  monotonyRisk: string;
  emotionalRange: string;
}

export interface WeakSpot {
  chapter: number;
  issue: string;
  suggestion: string;
}

export interface PowerMoment {
  chapter: number;
  emotion: string;
  intensity: number;
  technique: string;
}

export interface EmotionOptimization {
  emotionalDiversityScore: number;
  transitionSmoothness: number;
  peakValleyRatio: string;
  suggestions: string[];
}

export interface EmotionJourneyResult {
  journeyData: EmotionJourneyData[];
  emotionalArc: EmotionArc;
  weakSpots: WeakSpot[];
  powerMoments: PowerMoment[];
  optimization: EmotionOptimization;
}

export const emotionJourneyService = {
  map: (projectId: string, params?: {
    chapterIds?: string[];
    emotions?: string[];
  }): Promise<ApiResponse<EmotionJourneyResult>> =>
    apiClient.post(`/projects/${projectId}/emotion-journey/map`, params || {
      emotions: ['tension', 'joy', 'sadness', 'anticipation'],
    }),
};
