import { apiClient } from "./apiClient";
import type { ChapterComment } from "@/types/project";
import type { ApiResponse } from "@/types/api";

export const commentService = {
  async getComments(projectId: string, chapterId: string): Promise<ApiResponse<ChapterComment[]>> {
    return apiClient.get<ChapterComment[]>(`/projects/${projectId}/chapters/${chapterId}/comments`);
  },

  async create(projectId: string, chapterId: string, data: {
    content: string;
    userId: string;
    selectionFrom?: number;
    selectionTo?: number;
    selectionText?: string;
  }): Promise<ApiResponse<ChapterComment>> {
    return apiClient.post<ChapterComment>(`/projects/${projectId}/chapters/${chapterId}/comments`, data);
  },

  async update(projectId: string, chapterId: string, commentId: string, content: string): Promise<ApiResponse<ChapterComment>> {
    return apiClient.put<ChapterComment>(`/projects/${projectId}/chapters/${chapterId}/comments/${commentId}`, { content });
  },

  async resolve(projectId: string, chapterId: string, commentId: string): Promise<ApiResponse<ChapterComment>> {
    return apiClient.put<ChapterComment>(`/projects/${projectId}/chapters/${chapterId}/comments/${commentId}/resolve`, {});
  },

  async remove(projectId: string, chapterId: string, commentId: string): Promise<ApiResponse<unknown>> {
    return apiClient.delete(`/projects/${projectId}/chapters/${chapterId}/comments/${commentId}`);
  },
};
