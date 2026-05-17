import { apiClient } from './apiClient';
import type { ApiResponse } from '@/types/api';

export interface PrimaryTheme {
  theme: string;
  description: string;
  prominence: number;
  chaptersPresent: number[];
  keyQuotes: string[];
  literaryTradition: string;
}

export interface MotifOccurrence {
  chapter: number;
  description: string;
}

export interface Motif {
  motif: string;
  type: string;
  occurrences: MotifOccurrence[];
  evolution: string;
  significance: string;
}

export interface Symbolism {
  symbol: string;
  literalMeaning: string;
  metaphoricalMeaning: string;
  occurrences: number;
  layers: string[];
}

export interface ThematicArc {
  pattern: string;
  centralConflict: string;
  resolutionDirection: string;
  philosophicalDepth: number;
}

export interface LiteraryAnalysis {
  genreContribution: string;
  originality: number;
  culturalContext: string;
  comparativeNotes: string;
}

export interface ThemeAnalysisResult {
  primaryThemes: PrimaryTheme[];
  motifs: Motif[];
  symbolism: Symbolism[];
  thematicArc: ThematicArc;
  literaryAnalysis: LiteraryAnalysis;
  suggestions: string[];
}

export const themeAnalysisService = {
  analyze: (projectId: string, params?: {
    chapterIds?: string[];
    depth?: 'surface' | 'deep' | 'comprehensive';
  }): Promise<ApiResponse<ThemeAnalysisResult>> =>
    apiClient.post(`/projects/${projectId}/theme-analysis/analyze`, params || { depth: 'deep' }),
};
