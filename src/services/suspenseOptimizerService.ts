import { apiClient } from './apiClient';
import type { ApiResponse } from '@/types/api';

export interface SuspenseCurvePoint {
  chapter: number;
  tension: number;
  suspense_type: string;
  hooks: string[];
}

export interface TechniqueUsed {
  name: string;
  chapters: number[];
  effectiveness: number;
}

export interface WeakPoint {
  chapter: number;
  issue: string;
  suggestion: string;
}

export interface PeakMoment {
  chapter: number;
  type: string;
  technique: string;
}

export interface AnalyzeResult {
  suspense_curve: SuspenseCurvePoint[];
  techniques_used: TechniqueUsed[];
  weak_points: WeakPoint[];
  peak_moments: PeakMoment[];
  overall_assessment: {
    suspense_score: number;
    tension_rhythm: string;
    sustained_interest: number;
    climax_effectiveness: number;
  };
}

export interface OptimizationAddition {
  technique: string;
  description: string;
  sample_text: string;
}

export interface ChapterOptimization {
  chapter: number;
  current_tension: number;
  optimized_tension: number;
  additions: OptimizationAddition[];
  removals: string[];
  reorder_suggestion: string;
}

export interface NewHook {
  position: string;
  type: string;
  content: string;
}

export interface OptimizeResult {
  optimizations: ChapterOptimization[];
  new_hooks: NewHook[];
  timeline_adjustments: string;
  tips: string[];
}

export interface ApplicableTechnique {
  name: string;
  description: string;
  applicable_chapters: number[];
  implementation: string;
  expected_impact: number;
  difficulty: 'easy' | 'medium' | 'hard';
  example: string;
}

export interface TechniqueCombination {
  combo: string;
  effect: string;
  chapters: number[];
}

export interface TechniquesResult {
  applicable_techniques: ApplicableTechnique[];
  technique_combinations: TechniqueCombination[];
  genre_specific_tips: string[];
  advanced_techniques: string[];
  common_mistakes: string[];
}

export const suspenseOptimizerService = {
  optimize: (
    projectId: string,
    params: {
      chapterIds?: string[];
      mode: 'analyze' | 'optimize' | 'techniques';
    },
  ): Promise<ApiResponse<AnalyzeResult | OptimizeResult | TechniquesResult>> =>
    apiClient.post(`/projects/${projectId}/suspense-optimizer/optimize`, params),
};
