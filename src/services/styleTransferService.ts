import { apiClient } from './apiClient';

export const styleTransferService = {
  transfer: (projectId: string, params: {
    content?: string; chapterId?: string; styleId: string; authorName?: string; intensity?: string;
  }) => {
    return apiClient.post(`/projects/${projectId}/style-transfer/transfer`, params);
  },
  imitate: (projectId: string, params: {
    authorName: string; content?: string; chapterId?: string; scene?: string;
  }) => {
    return apiClient.post(`/projects/${projectId}/style-transfer/imitate`, params);
  },
  listStyles: () => {
    const res = apiClient.get('/projects/dummy/style-transfer/styles');
    return res;
  },
};
