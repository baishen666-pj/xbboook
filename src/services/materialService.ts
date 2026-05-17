import { apiClient } from './apiClient';

export interface Material {
  id: string;
  project_id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  source: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export const materialService = {
  list(projectId: string, category?: string) {
    const params = category ? `?category=${category}` : '';
    return apiClient.get<Material[]>(`/projects/${projectId}/materials${params}`);
  },

  search(projectId: string, query: string) {
    return apiClient.get<Material[]>(`/projects/${projectId}/materials?q=${encodeURIComponent(query)}`);
  },

  stats(projectId: string) {
    return apiClient.get<Array<{ category: string; count: number }>>(`/projects/${projectId}/materials/stats`);
  },

  create(projectId: string, data: { title: string; content: string; category?: string; tags?: string[]; source?: string }) {
    return apiClient.post<Material>(`/projects/${projectId}/materials`, data);
  },

  update(projectId: string, materialId: string, data: { title?: string; content?: string; category?: string; tags?: string[] }) {
    return apiClient.put<Material>(`/projects/${projectId}/materials/${materialId}`, data);
  },

  remove(projectId: string, materialId: string) {
    return apiClient.delete<void>(`/projects/${projectId}/materials/${materialId}`);
  },
};
