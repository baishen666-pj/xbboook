import { apiClient } from './apiClient';
import type { ApiResponse } from '@/types/api';

export interface GeneratedName {
  name: string;
  meaning: string;
  style: string;
}

export const nameGeneratorService = {
  async generate(projectId: string, data: {
    category: 'character' | 'location' | 'technique' | 'faction';
    context: string;
    count?: number;
    gender?: string;
    race?: string;
  }): Promise<ApiResponse<{ names: GeneratedName[] }>> {
    return apiClient.post(`/projects/${projectId}/name-generator/generate`, data);
  },
};
