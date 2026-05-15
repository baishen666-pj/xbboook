import { apiClient } from "./apiClient";
import type { CollabUser, OnlineUser, ChapterLock } from "@/types/project";
import type { ApiResponse } from "@/types/api";

export const collabService = {
  async identify(data: { username: string; displayName: string; avatarColor?: string }): Promise<ApiResponse<CollabUser>> {
    return apiClient.post<CollabUser>("/users/identify", data);
  },

  async getMe(userId: string): Promise<ApiResponse<CollabUser>> {
    return apiClient.get<CollabUser>(`/users/me?userId=${userId}`);
  },

  async getOnlineUsers(projectId: string): Promise<ApiResponse<OnlineUser[]>> {
    return apiClient.get<OnlineUser[]>(`/projects/${projectId}/collab/online`);
  },

  async getMembers(projectId: string): Promise<ApiResponse<unknown[]>> {
    return apiClient.get<unknown[]>(`/projects/${projectId}/collab/members`);
  },

  async addMember(projectId: string, userId: string): Promise<ApiResponse<{ projectId: string; userId: string }>> {
    return apiClient.post<{ projectId: string; userId: string }>(`/projects/${projectId}/collab/members`, { userId });
  },

  async acquireLock(projectId: string, chapterId: string, userId: string): Promise<ApiResponse<{ chapterId: string; userId: string }>> {
    return apiClient.post<{ chapterId: string; userId: string }>(`/projects/${projectId}/collab/lock/${chapterId}`, { userId });
  },

  async releaseLock(projectId: string, chapterId: string, userId: string): Promise<ApiResponse<unknown>> {
    return apiClient.delete<unknown>(`/projects/${projectId}/collab/lock/${chapterId}?userId=${userId}`);
  },

  async getLocks(projectId: string): Promise<ApiResponse<ChapterLock[]>> {
    return apiClient.get<ChapterLock[]>(`/projects/${projectId}/collab/locks`);
  },
};

export type WsMessage =
  | { type: 'join'; payload: { userId: string; projectId: string } }
  | { type: 'ping'; payload: Record<string, unknown> };

export function createCollabWs(): WebSocket | null {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const url = `${protocol}//${window.location.host}/ws`;
  try {
    return new WebSocket(url);
  } catch {
    return null;
  }
}
