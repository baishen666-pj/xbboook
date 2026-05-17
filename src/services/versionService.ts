import { apiClient } from "./apiClient";
import type { ChapterVersion } from "@/types/project";
import type { ApiResponse } from "@/types/api";

export const versionService = {
  async list(projectId: string, chapterId: string): Promise<ApiResponse<ChapterVersion[]>> {
    return apiClient.get<ChapterVersion[]>(`/projects/${projectId}/chapters/${chapterId}/versions`);
  },

  async getById(projectId: string, chapterId: string, versionId: string): Promise<ApiResponse<ChapterVersion>> {
    return apiClient.get<ChapterVersion>(`/projects/${projectId}/chapters/${chapterId}/versions/${versionId}`);
  },

  async create(projectId: string, chapterId: string, data?: { label?: string }): Promise<ApiResponse<ChapterVersion | null>> {
    return apiClient.post<ChapterVersion | null>(`/projects/${projectId}/chapters/${chapterId}/versions`, data ?? {});
  },

  async rollback(projectId: string, chapterId: string, versionId: string): Promise<ApiResponse<{ content: string }>> {
    return apiClient.post<{ content: string }>(`/projects/${projectId}/chapters/${chapterId}/versions/${versionId}/rollback`, {});
  },

  async remove(projectId: string, chapterId: string, versionId: string): Promise<ApiResponse<void>> {
    return apiClient.delete<void>(`/projects/${projectId}/chapters/${chapterId}/versions/${versionId}`);
  },

  async diff(projectId: string, chapterId: string, versionId: string, otherVersionId: string) {
    return apiClient.get<{
      left: { id: string; versionNumber: number; label: string | null; createdAt: string };
      right: { id: string; versionNumber: number; label: string | null; createdAt: string };
      hunks: Array<{ type: 'add' | 'remove' | 'equal'; lines: string[] }>;
      stats: { added: number; removed: number; unchanged: number };
    }>(`/projects/${projectId}/chapters/${chapterId}/versions/${versionId}/diff/${otherVersionId}`);
  },
};
