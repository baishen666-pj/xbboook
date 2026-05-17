import { apiClient } from "./apiClient";

export interface ContentAnalysis {
  readabilityScore: number;
  avgParagraphLength: number;
  longestParagraph: number;
  shortestParagraph: number;
  dialogueRatio: number;
  vocabularyDiversity: number;
  rhythmScore: number;
  paragraphLengths: number[];
}

export const contentAnalysisService = {
  async getAnalysis(
    projectId: string,
    chapterId?: string
  ): Promise<ContentAnalysis | null> {
    const query = chapterId ? `?chapterId=${chapterId}` : "";
    const res = await apiClient.get<ContentAnalysis>(
      `/projects/${projectId}/stats/content-analysis${query}`
    );
    return res.success ? res.data ?? null : null;
  },
};
