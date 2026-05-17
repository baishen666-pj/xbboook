import { apiClient } from "./apiClient";
import type { ApiResponse } from "@/types/api";

export interface SnapshotInfo {
  filename: string;
  size: number;
  createdAt: string;
}

export interface SnapshotResult {
  filename: string;
  tables: string[];
  totalRows: number;
}

export const autoBackupService = {
  async createSnapshot(projectId: string): Promise<ApiResponse<SnapshotResult>> {
    return apiClient.post<SnapshotResult>(`/projects/${projectId}/auto-backup/snapshot`, {});
  },

  async listSnapshots(projectId: string): Promise<ApiResponse<SnapshotInfo[]>> {
    return apiClient.get<SnapshotInfo[]>(`/projects/${projectId}/auto-backup/snapshots`);
  },

  async restore(projectId: string, filename: string): Promise<ApiResponse<{ restoredTables: number }>> {
    return apiClient.post<{ restoredTables: number }>(`/projects/${projectId}/auto-backup/restore`, { filename });
  },
};
