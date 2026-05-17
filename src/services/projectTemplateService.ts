import { apiClient } from "./apiClient";

export interface ProjectTemplate {
  id: string;
  name: string;
  genre: string | null;
  description: string | null;
  isBuiltin: boolean;
  structure: string;
  createdAt: string;
  updatedAt: string;
}

export const projectTemplateService = {
  list(genre?: string) {
    const params = genre ? `?genre=${encodeURIComponent(genre)}` : "";
    return apiClient.get<ProjectTemplate[]>(`/project-templates${params}`);
  },

  getById(id: string) {
    return apiClient.get<ProjectTemplate>(`/project-templates/${id}`);
  },

  apply(templateId: string) {
    return apiClient.post<Project>(`/project-templates/${templateId}/apply`, {});
  },

  createFromProject(projectId: string, name: string, description?: string) {
    return apiClient.post<ProjectTemplate>("/project-templates/from-project", {
      projectId,
      name,
      description,
    });
  },

  create(data: { name: string; genre?: string; description?: string; structure: string }) {
    return apiClient.post<ProjectTemplate>("/project-templates", data);
  },

  remove(id: string) {
    return apiClient.delete<void>(`/project-templates/${id}`);
  },
};

interface Project {
  id: string;
  name: string;
}
