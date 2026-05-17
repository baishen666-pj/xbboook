import { apiClient } from './apiClient';
import type { ApiResponse } from '@/types/api';

export interface CompareResult {
  textA: string;
  textB: string;
  titleA: string;
  titleB: string;
}

export const chapterCompareService = {
  async compare(projectId: string, data: { chapterIdA: string; chapterIdB: string; versionIdA?: string; versionIdB?: string }): Promise<ApiResponse<CompareResult>> {
    return apiClient.post(`/projects/${projectId}/chapter-compare/compare`, data);
  },
};
