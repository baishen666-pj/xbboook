import { apiClient } from "./apiClient";
import type { Worldview } from "@/types/project";
import type { ApiResponse } from "@/types/api";

interface WorldviewListResponse {
  items: Worldview[];
  categories: string[];
}

export const worldviewService = {
  async list(projectId: string): Promise<ApiResponse<WorldviewListResponse>> {
    return apiClient.get<WorldviewListResponse>(`/projects/${projectId}/worldviews`);
  },

  async listByCategory(projectId: string, category: string): Promise<ApiResponse<Worldview[]>> {
    return apiClient.get<Worldview[]>(`/projects/${projectId}/worldviews?category=${encodeURIComponent(category)}`);
  },

  async getById(projectId: string, id: string): Promise<ApiResponse<Worldview>> {
    return apiClient.get<Worldview>(`/projects/${projectId}/worldviews/${id}`);
  },

  async create(projectId: string, data: {
    category: string;
    title: string;
    content?: string;
  }): Promise<ApiResponse<Worldview>> {
    return apiClient.post<Worldview>(`/projects/${projectId}/worldviews`, data);
  },

  async update(projectId: string, id: string, data: Partial<Pick<Worldview, "category" | "title" | "content">>): Promise<ApiResponse<Worldview>> {
    return apiClient.put<Worldview>(`/projects/${projectId}/worldviews/${id}`, data);
  },

  async remove(projectId: string, id: string): Promise<ApiResponse<void>> {
    return apiClient.delete<void>(`/projects/${projectId}/worldviews/${id}`);
  },
};
