import { apiClient } from './apiClient';
import type { ApiResponse } from '@/types/api';

export interface WorldElementDimension {
  established: string[];
  confidence: number;
}

export interface MagicOrPowerDimension {
  established: string[];
  rules: string[];
  confidence: number;
}

export interface TechnologyDimension {
  level: string;
  established: string[];
  confidence: number;
}

export interface SocietyDimension {
  structure: string;
  established: string[];
  confidence: number;
}

export interface HistoryDimension {
  timeline: string[];
  confidence: number;
}

export interface EconomyDimension {
  system: string;
  established: string[];
  confidence: number;
}

export interface RacesFactionsDimension {
  groups: string[];
  relationships: string[];
  confidence: number;
}

export interface WorldElements {
  geography: WorldElementDimension;
  magicOrPower: MagicOrPowerDimension;
  technology: TechnologyDimension;
  society: SocietyDimension;
  history: HistoryDimension;
  economy: EconomyDimension;
  racesFactions: RacesFactionsDimension;
}

export interface FixOption {
  approach: string;
  impact: string;
  difficulty: string;
}

export interface Inconsistency {
  id: number;
  severity: string;
  dimension: string;
  description: string;
  location1: { chapter: number; text: string };
  location2: { chapter: number; text: string };
  fixOptions: FixOption[];
}

export interface WorldGap {
  dimension: string;
  description: string;
  importance: string;
  suggestion: string;
}

export interface WorldConsistencyResult {
  worldElements: WorldElements;
  inconsistencies: Inconsistency[];
  gaps: WorldGap[];
  overallConsistency: number;
  recommendations: string[];
}

export const worldConsistencyService = {
  check: (projectId: string, params: {
    chapterIds?: string[];
    dimensions?: string[];
  }): Promise<ApiResponse<WorldConsistencyResult>> => {
    return apiClient.post(`/projects/${projectId}/world-consistency/check`, params);
  },
};
