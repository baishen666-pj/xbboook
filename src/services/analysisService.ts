import { apiClient } from './apiClient';

export interface AnalysisResult {
  analysisType: string;
  result: unknown;
  chaptersAnalyzed: number;
  tokensUsed: number;
}

export interface QuickStats {
  totalChapters: number;
  totalWords: number;
  avgWordsPerChapter: number;
  publishedChapters: number;
  volumeCount: number;
  chapters: Array<{
    id: string;
    title: string;
    wordCount: number;
    status: string;
    volumeId: string | null;
  }>;
}

export interface AnalysisType {
  id: string;
  name: string;
  icon: string;
  description: string;
}

export const analysisService = {
  run(projectId: string, analysisType: string, chapterIds?: string[], characterId?: string) {
    return apiClient.post<AnalysisResult>(`/projects/${projectId}/analysis`, {
      analysisType,
      chapterIds,
      characterId,
    });
  },

  quickStats(projectId: string) {
    return apiClient.get<QuickStats>(`/projects/${projectId}/analysis/quick`);
  },

  types() {
    return apiClient.get<AnalysisType[]>('/projects/dummy/analysis/types');
  },
};
