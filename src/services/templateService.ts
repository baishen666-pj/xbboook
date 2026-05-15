import { apiClient } from "./apiClient";
import type { OutlineTemplate } from "@/types/project";
import type { ApiResponse } from "@/types/api";

export const templateService = {
  async list(genre?: string): Promise<ApiResponse<OutlineTemplate[]>> {
    const query = genre ? `?genre=${encodeURIComponent(genre)}` : "";
    return apiClient.get<OutlineTemplate[]>(`/templates${query}`);
  },

  async getById(id: string): Promise<ApiResponse<OutlineTemplate>> {
    return apiClient.get<OutlineTemplate>(`/templates/${id}`);
  },

  async create(data: { name: string; genre: string; description?: string; structure: string }): Promise<ApiResponse<OutlineTemplate>> {
    return apiClient.post<OutlineTemplate>("/templates", data);
  },

  async apply(templateId: string, projectId: string, mode: "replace" | "append" = "append"): Promise<ApiResponse<unknown>> {
    return apiClient.post<unknown>(`/templates/${templateId}/apply`, { projectId, mode });
  },

  async remove(id: string): Promise<ApiResponse<void>> {
    return apiClient.delete<void>(`/templates/${id}`);
  },
};
