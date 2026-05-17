import { apiClient } from "./apiClient";
import type { ApiResponse } from "@/types/api";

export interface TagInfo {
  name: string;
  count: number;
}

export const chapterTagService = {
  async listTags(projectId: string): Promise<ApiResponse<TagInfo[]>> {
    return apiClient.get<TagInfo[]>(`/projects/${projectId}/chapter-tags/tags`);
  },

  async searchByTags(projectId: string, tags: string[], mode: 'any' | 'all' = 'any'): Promise<ApiResponse<any[]>> {
    return apiClient.post<any[]>(`/projects/${projectId}/chapter-tags/search`, { tags, mode });
  },
};
