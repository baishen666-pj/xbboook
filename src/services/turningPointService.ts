import { apiClient } from "./apiClient";
import type { ApiResponse } from "@/types/api";

export interface TurningPoint {
  id: string;
  projectId: string;
  chapterId: string | null;
  title: string;
  description: string | null;
  turnType: string;
  severity: string;
  foreshadowPlanted: boolean;
  foreshadowResolved: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export const TURN_TYPE_LABELS: Record<string, string> = {
  reversal: '反转', revelation: '揭秘', sacrifice: '牺牲', betrayal: '背叛',
  growth: '成长', crisis: '危机', climax: '高潮', other: '其他',
};

export const SEVERITY_LABELS: Record<string, string> = {
  minor: '轻微', moderate: '中等', major: '重大', critical: '关键',
};

export const turningPointService = {
  async list(projectId: string): Promise<ApiResponse<TurningPoint[]>> {
    return apiClient.get<TurningPoint[]>(`/projects/${projectId}/turning-points`);
  },

  async create(projectId: string, data: {
    title: string; chapterId?: string; description?: string;
    turnType?: string; severity?: string;
  }): Promise<ApiResponse<TurningPoint>> {
    return apiClient.post<TurningPoint>(`/projects/${projectId}/turning-points`, data);
  },

  async update(projectId: string, id: string, data: Partial<TurningPoint>): Promise<ApiResponse<TurningPoint>> {
    return apiClient.patch<TurningPoint>(`/projects/${projectId}/turning-points/${id}`, data);
  },

  async remove(projectId: string, id: string): Promise<ApiResponse<void>> {
    return apiClient.delete<void>(`/projects/${projectId}/turning-points/${id}`);
  },

  async analyze(projectId: string): Promise<ApiResponse<any>> {
    return apiClient.post<any>(`/projects/${projectId}/turning-points/analyze`, {});
  },
};
