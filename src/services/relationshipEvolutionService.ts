import { apiClient } from './apiClient';
import type { ApiResponse } from '@/types/api';

export interface EvolutionPoint {
  chapter: number;
  state: string;
  intimacy: number;
  event: string;
}

export interface TurningPoint {
  chapter: number;
  event: string;
  fromState: string;
  toState: string;
}

export interface RelationshipPair {
  characters: string[];
  relationshipType: string;
  evolution: EvolutionPoint[];
  turningPoints: TurningPoint[];
  currentState: string;
  predictedDirection: string;
  dynamicsScore: number;
}

export interface RelationshipMap {
  totalPairs: number;
  mostDynamic: string;
  mostStable: string;
  tensionHotspot: string;
}

export interface RelationshipSuggestion {
  pair: string;
  suggestion: string;
  timing: string;
}

export interface RelationshipEvolutionResult {
  pairs: RelationshipPair[];
  relationshipMap: RelationshipMap;
  suggestions: RelationshipSuggestion[];
}

export const relationshipEvolutionService = {
  analyze: (projectId: string, params?: {
    chapterIds?: string[];
    characterPair?: string[];
  }): Promise<ApiResponse<RelationshipEvolutionResult>> =>
    apiClient.post(`/projects/${projectId}/relationship-evolution/analyze`, params || {}),
};
