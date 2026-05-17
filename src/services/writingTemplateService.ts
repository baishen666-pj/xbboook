import { apiClient } from './apiClient';
import type { ApiResponse } from '@/types/api';

export interface WritingTemplate {
  id: string;
  projectId: string;
  name: string;
  category: string;
  description: string;
  content: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export const writingTemplateService = {
  async list(projectId: string): Promise<ApiResponse<WritingTemplate[]>> {
    return apiClient.get(`/projects/${projectId}/writing-templates`);
  },
  async create(projectId: string, data: { name: string; category: string; content: string; description?: string }): Promise<ApiResponse<WritingTemplate>> {
    return apiClient.post(`/projects/${projectId}/writing-templates`, data);
  },
  async update(projectId: string, templateId: string, data: Partial<WritingTemplate>): Promise<ApiResponse<WritingTemplate>> {
    return apiClient.put(`/projects/${projectId}/writing-templates/${templateId}`, data);
  },
  async delete(projectId: string, templateId: string): Promise<ApiResponse<void>> {
    return apiClient.delete(`/projects/${projectId}/writing-templates/${templateId}`);
  },
  async apply(projectId: string, templateId: string, chapterId: string): Promise<ApiResponse<{ applied: boolean }>> {
    return apiClient.post(`/projects/${projectId}/writing-templates/apply/${chapterId}`, { templateId });
  },
};
