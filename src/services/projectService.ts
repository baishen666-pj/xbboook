import { apiClient } from "./apiClient";
import type { Project } from "@/types/project";
import type { ApiResponse } from "@/types/api";

const PATH = "/projects";

export const projectService = {
  async list(): Promise<ApiResponse<Project[]>> {
    return apiClient.get<Project[]>(PATH);
  },

  async getById(id: string): Promise<ApiResponse<Project>> {
    return apiClient.get<Project>(`${PATH}/${id}`);
  },

  async create(
    data: Pick<Project, "name" | "genre" | "description" | "writingMode">
  ): Promise<ApiResponse<Project>> {
    return apiClient.post<Project>(PATH, data);
  },

  async update(
    id: string,
    data: Partial<Pick<Project, "name" | "genre" | "description" | "writingMode">>
  ): Promise<ApiResponse<Project>> {
    return apiClient.put<Project>(`${PATH}/${id}`, data);
  },

  async remove(id: string): Promise<ApiResponse<void>> {
    return apiClient.delete<void>(`${PATH}/${id}`);
  },

  async reorderVolumes(projectId: string, items: { id: string; sortOrder: number }[]): Promise<ApiResponse<void>> {
    return apiClient.put<void>(`${PATH}/${projectId}/volumes/reorder`, { items });
  },
};
