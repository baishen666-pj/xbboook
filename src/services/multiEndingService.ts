import { apiClient } from './apiClient';

export const multiEndingService = {
  generate: async (projectId: string, params?: {
    chapterIds?: string[]; endingTypes?: string[]; characterFocus?: string; constraints?: string;
  }) => {
    const res = await apiClient.post(`/projects/${projectId}/multi-ending/generate`, params || {
      endingTypes: ['happy', 'tragic', 'twist', 'open'],
    });
    return res.data;
  },
};
