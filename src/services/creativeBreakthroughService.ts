import { apiClient } from './apiClient';

export const creativeBreakthroughService = {
  whatIf: async (projectId: string, params: {
    chapterId?: string; content?: string; aspect?: string; count?: number;
  }) => {
    return apiClient.post(`/projects/${projectId}/creative-breakthrough/what-if`, params);
  },
  constraintWrite: async (projectId: string, params: {
    content?: string; chapterId?: string; constraints: Array<{ type: string; description?: string }>;
  }) => {
    return apiClient.post(`/projects/${projectId}/creative-breakthrough/constraint-write`, params);
  },
  genreBlend: async (projectId: string, params: {
    content?: string; chapterId?: string; genres: string[];
  }) => {
    return apiClient.post(`/projects/${projectId}/creative-breakthrough/genre-blend`, params);
  },
};
