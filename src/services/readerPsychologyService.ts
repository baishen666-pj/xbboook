import { apiClient } from './apiClient';
import type { ApiResponse } from '@/types/api';

export interface AttentionManagement {
  score: number;
  hooks_used: string[];
  weak_moments: { chapter: number; issue: string }[];
  improvements: string[];
}

export interface EmotionalEngineering {
  score: number;
  techniques: string[];
  emotional_peaks: { chapter: number; technique: string }[];
  emotional_gaps: { chapter: number; issue: string }[];
  improvements: string[];
}

export interface ImmersionFactors {
  score: number;
  breaking_factors: string[];
  enhancing_factors: string[];
  improvements: string[];
}

export interface AddictionMechanisms {
  score: number;
  variable_rewards: { chapter: number; type: string; description: string }[];
  cliffhangers: { chapter: number; type: string; strength: number }[];
  progress_loops: string[];
  social_proof_triggers: string[];
  improvements: string[];
}

export interface PsychologicalProfile {
  attention_management: AttentionManagement;
  emotional_engineering: EmotionalEngineering;
  immersion_factors: ImmersionFactors;
  addiction_mechanisms: AddictionMechanisms;
}

export interface CognitiveLoadPoint {
  chapter: number;
  load: number;
}

export interface EngagementPrediction {
  chapter: number;
  predicted_engagement: number;
  primary_driver: string;
}

export interface DropoffRisk {
  chapter: number;
  risk: number;
  psychological_reason: string;
}

export interface ReaderJourneyMap {
  cognitive_load: CognitiveLoadPoint[];
  engagement_prediction: EngagementPrediction[];
  dropoff_risks: DropoffRisk[];
}

export interface PsychologicalTrigger {
  trigger: string;
  description: string;
  current_usage: number;
  optimal_usage: string;
  sample_implementation: string;
}

export interface AnalyzeResult {
  psychological_profile: PsychologicalProfile;
  reader_journey_map: ReaderJourneyMap;
  psychological_triggers: PsychologicalTrigger[];
  recommendations: string[];
}

export const readerPsychologyService = {
  analyze: (
    projectId: string,
    params: {
      chapterIds?: string[];
      focus: 'attention' | 'emotion' | 'immersion' | 'addiction' | 'all';
    },
  ): Promise<ApiResponse<AnalyzeResult>> =>
    apiClient.post(`/projects/${projectId}/reader-psychology/analyze`, params),
};
