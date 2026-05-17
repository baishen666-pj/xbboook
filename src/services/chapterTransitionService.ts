import { apiClient } from './apiClient';
import type { ApiResponse } from '@/types/api';

export interface TransitionAnalysis {
  fromMood: string;
  toMood: string;
  gapType: string;
  gapDescription: string;
  recommendedType: string;
}

export interface TransitionOption {
  type: string;
  text: string;
  wordCount: number;
  tone: string;
  techniquesUsed: string[];
}

export interface ChapterTransitionResult {
  transitionAnalysis: TransitionAnalysis;
  transitions: TransitionOption[];
  tips: string[];
}

export const chapterTransitionService = {
  generate: (projectId: string, params: {
    fromChapterId: string;
    toChapterId: string;
    transitionType?: 'time_skip' | 'scene_shift' | 'perspective_switch' | 'emotion_turn' | 'suspense_bridge' | 'auto';
    length?: 'brief' | 'moderate' | 'extended';
  }): Promise<ApiResponse<ChapterTransitionResult>> =>
    apiClient.post(`/projects/${projectId}/chapter-transition/generate`, params),
};
