import { apiClient } from './apiClient';
import type { SnippetTemplate } from '../types/project';
import type { ApiResponse } from '../types/api';

export const snippetService = {
  async fetchSnippets(projectId: string, category?: string): Promise<ApiResponse<SnippetTemplate[]>> {
    const params = category ? `?category=${encodeURIComponent(category)}` : '';
    return apiClient.get<SnippetTemplate[]>(`/snippets/${projectId}${params}`);
  },

  async createSnippet(projectId: string, data: {
    name: string;
    category?: string;
    content: string;
  }): Promise<ApiResponse<SnippetTemplate>> {
    return apiClient.post<SnippetTemplate>(`/snippets/${projectId}`, data);
  },

  async updateSnippet(id: number, data: Partial<{
    name: string;
    category: string;
    content: string;
    sort_order: number;
  }>): Promise<ApiResponse<SnippetTemplate>> {
    return apiClient.patch<SnippetTemplate>(`/snippets/${id}`, data);
  },

  async deleteSnippet(id: number): Promise<ApiResponse<null>> {
    return apiClient.delete<null>(`/snippets/${id}`);
  },
};