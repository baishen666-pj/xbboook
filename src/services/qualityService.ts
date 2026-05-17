import { apiClient } from './apiClient';
import type { ApiResponse } from '@/types/api';

export interface QualityIssue {
  type: 'grammar' | 'style' | 'readability' | 'repetition' | 'clarity';
  severity: 'info' | 'warning' | 'error';
  message: string;
  offset: number;
  length: number;
  suggestion: string;
}

export interface QualityReport {
  overallScore: number;
  readabilityScore: number;
  avgSentenceLength: number;
  avgWordLength: number;
  totalSentences: number;
  totalParagraphs: number;
  vocabularyRichness: number;
  issues: QualityIssue[];
  summary: string;
}

export interface QualityComparison {
  before: QualityReport;
  after: QualityReport;
  comparison: {
    scoreDiff: number;
    improvements: string[];
    regressions: string[];
  };
}

export const qualityService = {
  async analyze(projectId: string, text: string): Promise<ApiResponse<QualityReport>> {
    return apiClient.post<QualityReport>(`/projects/${projectId}/quality/analyze`, { text });
  },

  async compare(projectId: string, textA: string, textB: string): Promise<ApiResponse<QualityComparison>> {
    return apiClient.post<QualityComparison>(`/projects/${projectId}/quality/compare`, { textA, textB });
  },
};
