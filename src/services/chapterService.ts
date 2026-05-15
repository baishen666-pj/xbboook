import { apiClient } from "./apiClient";
import type { Chapter } from "@/types/project";
import type { ApiResponse } from "@/types/api";

const PATH = "/chapters";

export const chapterService = {
  async list(projectId: string): Promise<ApiResponse<Chapter[]>> {
    return apiClient.get<Chapter[]>(`${PATH}?projectId=${projectId}`);
  },

  async getById(id: string): Promise<ApiResponse<Chapter>> {
    return apiClient.get<Chapter>(`${PATH}/${id}`);
  },

  async create(
    data: Pick<Chapter, "projectId" | "volumeId" | "title"> & {
      sortOrder?: number;
    }
  ): Promise<ApiResponse<Chapter>> {
    return apiClient.post<Chapter>(PATH, data);
  },

  async update(
    id: string,
    data: Partial<Pick<Chapter, "title" | "status" | "sortOrder" | "volumeId">>
  ): Promise<ApiResponse<Chapter>> {
    return apiClient.put<Chapter>(`${PATH}/${id}`, data);
  },

  async saveContent(id: string, content: string): Promise<ApiResponse<Chapter>> {
    return apiClient.put<Chapter>(`${PATH}/${id}/content`, { content });
  },

  async remove(id: string): Promise<ApiResponse<void>> {
    return apiClient.delete<void>(`${PATH}/${id}`);
  },

  async reorder(
    items: Array<{ id: string; sortOrder: number }>
  ): Promise<ApiResponse<void>> {
    return apiClient.put<void>(`${PATH}/reorder`, { items });
  },
};
