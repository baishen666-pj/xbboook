import { apiClient } from "./apiClient";
import type { Chapter, PublishStatus, ScheduleItem } from "@/types/project";
import type { ApiResponse } from "@/types/api";

export const chapterService = {
  async list(projectId: string): Promise<ApiResponse<Chapter[]>> {
    return apiClient.get<Chapter[]>(`/projects/${projectId}/chapters`);
  },

  async getById(projectId: string, id: string): Promise<ApiResponse<Chapter>> {
    return apiClient.get<Chapter>(`/projects/${projectId}/chapters/${id}`);
  },

  async create(
    projectId: string,
    data: Pick<Chapter, "volumeId" | "title"> & {
      sortOrder?: number;
    }
  ): Promise<ApiResponse<Chapter>> {
    return apiClient.post<Chapter>(`/projects/${projectId}/chapters`, data);
  },

  async update(
    projectId: string,
    id: string,
    data: Partial<Pick<Chapter, "title" | "status" | "sortOrder" | "volumeId" | "publishStatus" | "scheduledAt">>
  ): Promise<ApiResponse<Chapter>> {
    return apiClient.put<Chapter>(`/projects/${projectId}/chapters/${id}`, data);
  },

  async saveContent(projectId: string, id: string, content: string): Promise<ApiResponse<Chapter>> {
    return apiClient.put<Chapter>(`/projects/${projectId}/chapters/${id}/content`, { content });
  },

  async remove(projectId: string, id: string): Promise<ApiResponse<void>> {
    return apiClient.delete<void>(`/projects/${projectId}/chapters/${id}`);
  },

  async reorder(
    projectId: string,
    items: Array<{ id: string; volumeId?: string | null; sortOrder: number }>
  ): Promise<ApiResponse<void>> {
    return apiClient.put<void>(`/projects/${projectId}/chapters/reorder`, { items });
  },

  async fetchSchedule(projectId: string): Promise<ApiResponse<ScheduleItem[]>> {
    return apiClient.get<ScheduleItem[]>(`/projects/${projectId}/chapters/schedule`);
  },

  async updatePublishStatus(
    projectId: string,
    chapterId: string,
    data: { publish_status: PublishStatus; scheduled_at?: string | null }
  ): Promise<ApiResponse<Chapter>> {
    return apiClient.patch<Chapter>(`/projects/${projectId}/chapters/${chapterId}/publish-status`, data);
  },
};
