import { apiClient } from "./apiClient";
import type { ApiResponse } from "@/types/api";

export interface SplitResult {
  splitCount: number;
  chapters: Array<{ id: string; title: string; words: number }>;
}

export interface MergeResult {
  id: string;
  title: string;
  words: number;
  mergedCount: number;
}

export const chapterOpsService = {
  async split(projectId: string, chapterId: string, splitPoints: number[]): Promise<ApiResponse<SplitResult>> {
    return apiClient.post<SplitResult>(`/projects/${projectId}/chapter-ops/split`, {
      chapterId,
      splitPoints,
    });
  },

  async merge(projectId: string, chapterIds: string[], title?: string): Promise<ApiResponse<MergeResult>> {
    return apiClient.post<MergeResult>(`/projects/${projectId}/chapter-ops/merge`, {
      chapterIds,
      title,
    });
  },
};
