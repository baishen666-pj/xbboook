import { apiClient } from "./apiClient";
import type { Outline } from "@/types/project";
import type { ApiResponse } from "@/types/api";

export const outlineService = {
  async list(projectId: string): Promise<ApiResponse<Outline[]>> {
    return apiClient.get<Outline[]>(`/projects/${projectId}/outlines`);
  },

  async create(projectId: string, data: {
    title: string;
    level?: number;
    parentId?: string;
    content?: string;
    targetRefId?: string;
  }): Promise<ApiResponse<Outline>> {
    return apiClient.post<Outline>(`/projects/${projectId}/outlines`, data);
  },

  async update(projectId: string, id: string, data: Partial<Pick<Outline, "title" | "content" | "level" | "parentId" | "sortOrder">>): Promise<ApiResponse<Outline>> {
    return apiClient.put<Outline>(`/projects/${projectId}/outlines/${id}`, data);
  },

  async remove(projectId: string, id: string): Promise<ApiResponse<void>> {
    return apiClient.delete<void>(`/projects/${projectId}/outlines/${id}`);
  },
};
