import { apiClient } from './apiClient';

export interface PlatformInfo {
  id: string;
  name: string;
  extension: string;
}

export interface PlatformConfig {
  id: string;
  projectId: string;
  platform: string;
  config: Record<string, unknown>;
  lastExportAt: string | null;
  chapterMapping: Record<string, unknown>;
}

export const platformPublishService = {
  getPlatforms: () => apiClient.get<PlatformInfo[]>('/projects/default/platform-publish/platforms'),
  getConfigs: (projectId: string) => apiClient.get<PlatformConfig[]>(`/projects/${projectId}/platform-publish/configs`),
  saveConfig: (projectId: string, data: { platform: string; config?: Record<string, unknown>; chapterMapping?: Record<string, unknown> }) => apiClient.post(`/projects/${projectId}/platform-publish/configs`, data),
  deleteConfig: (projectId: string, platform: string) => apiClient.delete(`/projects/${projectId}/platform-publish/configs/${platform}`),
  getExportUrl: (projectId: string, platform: string, chapterIds?: string[]) => {
    const params = new URLSearchParams({ platform });
    if (chapterIds?.length) chapterIds.forEach(id => params.append('chapterIds', id));
    return `/api/projects/${projectId}/platform-publish/export?${params}`;
  },
  exportToPlatform: (projectId: string, data: { platform: string; chapterIds?: string[] }) => apiClient.post(`/projects/${projectId}/platform-publish/export`, data, { responseType: 'blob' }),
};
