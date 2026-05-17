import { apiClient } from './apiClient';
import type { ApiResponse } from '@/types/api';

export interface ReaderGroup {
  id: string;
  name: string;
  desc: string;
}

export interface GroupReaction {
  groupId: string;
  groupName: string;
  overallScore: number;
  satisfaction: number;
  retention: number;
  paymentWillingness: number;
  sharingLikelihood: number;
  favoriteAspects: string[];
  painPoints: string[];
  dropoffRisk: string;
  typicalComment: string;
  readingBehavior: string;
  improvementWishes: string[];
}

export interface MarketAnalysis {
  totalAddressableAudience: string;
  primarySegment: { group: string; affinity: number };
  secondarySegments: { group: string; affinity: number }[];
  competitiveAdvantage: string;
  marketRisks: string[];
  monetizationTips: string[];
}

export interface SimulateResult {
  workPositioning: { genre: string; targetAudience: string; marketPosition: string };
  groupReactions: GroupReaction[];
  marketAnalysis: MarketAnalysis;
  crossGroupInsights: string[];
  recommendations: string[];
}

export const readerGroupSimService = {
  getGroups(): Promise<ApiResponse<ReaderGroup[]>> {
    return apiClient.get('/projects/any/reader-group-sim/groups');
  },

  simulate(projectId: string, params?: {
    chapterIds?: string[];
    groups?: string[];
    aspects?: ('satisfaction' | 'retention' | 'payment' | 'sharing' | 'review')[];
  }): Promise<ApiResponse<SimulateResult>> {
    return apiClient.post(`/projects/${projectId}/reader-group-sim/simulate`, params || {
      aspects: ['satisfaction', 'retention', 'payment'],
    });
  },
};
