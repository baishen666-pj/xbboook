import { apiClient } from './apiClient';

export interface WritingSprint {
  id: string;
  projectId: string;
  userId: string;
  type: string;
  durationMinutes: number;
  targetWords: number;
  actualWords: number;
  status: string;
  startedAt: string | null;
  endedAt: string | null;
  notes: string;
  createdAt: string;
}

export interface SprintStatEntry {
  id: string;
  projectId: string;
  date: string;
  totalSprints: number;
  totalMinutes: number;
  totalWords: number;
  bestWpm: number;
}

export const writingSprintService = {
  list: (projectId: string, status?: string) => {
    const params = status ? `?status=${status}` : '';
    return apiClient.get<WritingSprint[]>(`/projects/${projectId}/sprints${params}`);
  },
  create: (projectId: string, data: { type: string; durationMinutes: number; targetWords?: number }) =>
    apiClient.post(`/projects/${projectId}/sprints`, data),
  start: (projectId: string, sprintId: string) =>
    apiClient.post(`/projects/${projectId}/sprints/${sprintId}/start`, {}),
  pause: (projectId: string, sprintId: string) =>
    apiClient.post(`/projects/${projectId}/sprints/${sprintId}/pause`, {}),
  resume: (projectId: string, sprintId: string) =>
    apiClient.post(`/projects/${projectId}/sprints/${sprintId}/resume`, {}),
  complete: (projectId: string, sprintId: string, data: { actualWords: number; notes?: string }) =>
    apiClient.post(`/projects/${projectId}/sprints/${sprintId}/complete`, data),
  abandon: (projectId: string, sprintId: string) =>
    apiClient.post(`/projects/${projectId}/sprints/${sprintId}/abandon`, {}),
  getStats: (projectId: string, days?: number) => {
    const params = days ? `?days=${days}` : '';
    return apiClient.get<SprintStatEntry[]>(`/projects/${projectId}/sprints/stats${params}`);
  },
  delete: (projectId: string, sprintId: string) =>
    apiClient.delete(`/projects/${projectId}/sprints/${sprintId}`),
};
