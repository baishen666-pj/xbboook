import { apiClient } from './apiClient';
import type { ApiResponse } from '@/types/api';

export interface DependencyEdge {
  id: string;
  projectId: string;
  sourceChapterId: string;
  targetChapterId: string;
  dependencyType: 'plot' | 'character' | 'foreshadowing' | 'timeline' | 'worldview';
  description: string;
  strength: 'weak' | 'normal' | 'strong';
  createdAt: string;
  sourceTitle: string;
  targetTitle: string;
  sourceSortOrder: number;
  targetSortOrder: number;
}

export interface DependencyStats {
  total: number;
  byType: Record<string, number>;
  byStrength: Record<string, number>;
  circularCount: number;
}

export const chapterDependencyService = {
  async list(projectId: string): Promise<ApiResponse<DependencyEdge[]>> {
    return apiClient.get<DependencyEdge[]>(`/projects/${projectId}/dependencies`);
  },

  async listByChapter(projectId: string, chapterId: string): Promise<ApiResponse<DependencyEdge[]>> {
    return apiClient.get<DependencyEdge[]>(`/projects/${projectId}/dependencies/chapter/${chapterId}`);
  },

  async getStats(projectId: string): Promise<ApiResponse<DependencyStats>> {
    return apiClient.get<DependencyStats>(`/projects/${projectId}/dependencies/stats`);
  },

  async getCycles(projectId: string): Promise<ApiResponse<string[][]>> {
    return apiClient.get<string[][]>(`/projects/${projectId}/dependencies/cycles`);
  },

  async create(projectId: string, data: {
    sourceChapterId: string;
    targetChapterId: string;
    dependencyType?: string;
    description?: string;
    strength?: string;
  }): Promise<ApiResponse<DependencyEdge>> {
    return apiClient.post<DependencyEdge>(`/projects/${projectId}/dependencies`, data);
  },

  async update(projectId: string, depId: string, data: Record<string, unknown>): Promise<ApiResponse<DependencyEdge>> {
    return apiClient.put<DependencyEdge>(`/projects/${projectId}/dependencies/${depId}`, data);
  },

  async remove(projectId: string, depId: string): Promise<ApiResponse<null>> {
    return apiClient.delete(`/projects/${projectId}/dependencies/${depId}`);
  },
};
