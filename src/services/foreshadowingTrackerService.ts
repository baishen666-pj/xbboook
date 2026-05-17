import { apiClient } from './apiClient';
import type { ApiResponse } from '@/types/api';

export interface ForeshadowingItem {
  id: number;
  title: string;
  description: string;
  plant_chapter: number;
  plant_detail: string;
  technique: string;
  technique_name: string;
  status: 'planted' | 'resolved' | 'partially_resolved' | 'abandoned';
  resolve_chapter?: number;
  resolve_detail?: string;
  subtlety: number;
  satisfaction: number;
  importance: 'major' | 'minor' | 'background';
  related_plot_thread?: string;
  tags?: string[];
}

export interface DetectResult {
  foreshadowings: ForeshadowingItem[];
  statistics: {
    total: number;
    resolved: number;
    planted: number;
    abandoned: number;
    resolution_rate: number;
    avg_satisfaction: number;
  };
}

export interface HealthTimeline {
  chapter: number;
  planted: number;
  resolved: number;
  open_count: number;
}

export interface HealthIssue {
  type: string;
  severity: 'high' | 'medium' | 'low';
  description: string;
  affected_foreshadowings: number[];
  suggestion: string;
}

export interface HealthResult {
  health_score: number;
  status: 'good' | 'warning' | 'critical';
  timeline: HealthTimeline[];
  issues: HealthIssue[];
  balance_analysis: {
    planting_rhythm: string;
    resolution_rhythm: string;
    tension_curve: string;
  };
  recommendations: string[];
}

export interface SuggestMethod {
  method: string;
  timing: string;
  sample_text: string;
  impact: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface UnresolvedForeshadowing {
  id: number;
  title: string;
  plant_chapter: number;
  importance: string;
  suggestions: SuggestMethod[];
}

export interface NewOpportunity {
  description: string;
  suggested_chapter: number;
  purpose: string;
  sample_text: string;
}

export interface SuggestResult {
  unresolved: UnresolvedForeshadowing[];
  new_opportunities: NewOpportunity[];
  weaving_tips: string[];
}

export const foreshadowingTrackerService = {
  track: (projectId: string, params: {
    chapterIds?: string[];
    mode: 'detect' | 'health' | 'suggest';
  }): Promise<ApiResponse<DetectResult | HealthResult | SuggestResult>> => {
    return apiClient.post(`/projects/${projectId}/foreshadowing-tracker/track`, params);
  },
};
