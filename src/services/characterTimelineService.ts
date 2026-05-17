import { apiClient } from "./apiClient";
import type { ApiResponse } from "@/types/api";

export interface TimelineEvent {
  id: string;
  projectId: string;
  characterId: string;
  chapterId: string | null;
  eventTitle: string;
  eventDescription: string | null;
  storyTime: string | null;
  sortOrder: number;
}

export const characterTimelineService = {
  async list(projectId: string, characterId?: string): Promise<ApiResponse<TimelineEvent[]>> {
    const params = characterId ? `?characterId=${characterId}` : '';
    return apiClient.get<TimelineEvent[]>(`/projects/${projectId}/timelines${params}`);
  },

  async create(projectId: string, data: {
    characterId: string; eventTitle: string; chapterId?: string;
    eventDescription?: string; storyTime?: string;
  }): Promise<ApiResponse<TimelineEvent>> {
    return apiClient.post<TimelineEvent>(`/projects/${projectId}/timelines`, data);
  },

  async update(projectId: string, id: string, data: Partial<TimelineEvent>): Promise<ApiResponse<TimelineEvent>> {
    return apiClient.patch<TimelineEvent>(`/projects/${projectId}/timelines/${id}`, data);
  },

  async remove(projectId: string, id: string): Promise<ApiResponse<void>> {
    return apiClient.delete<void>(`/projects/${projectId}/timelines/${id}`);
  },

  async detectConflicts(projectId: string): Promise<ApiResponse<any>> {
    return apiClient.post<any>(`/projects/${projectId}/timelines/detect-conflicts`, {});
  },
};
