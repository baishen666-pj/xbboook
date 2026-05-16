import { apiClient } from "./apiClient";
import type { ApiResponse } from "@/types/api";

export interface BackupInfo {
  id: string;
  createdAt: string;
  sizeBytes: number;
}

export interface BackupConfig {
  enabled: boolean;
  intervalHours: number;
  keepCount: number;
}

const PATH = "/backups";

export const backupService = {
  async listBackups(): Promise<ApiResponse<BackupInfo[]>> {
    return apiClient.get<BackupInfo[]>(PATH);
  },

  async createBackup(): Promise<ApiResponse<BackupInfo>> {
    return apiClient.post<BackupInfo>(PATH, {});
  },

  async deleteBackup(id: string): Promise<ApiResponse<void>> {
    return apiClient.delete<void>(`${PATH}/${id}`);
  },

  async getConfig(): Promise<ApiResponse<BackupConfig>> {
    return apiClient.get<BackupConfig>(`${PATH}/config`);
  },

  async updateConfig(patch: Partial<BackupConfig>): Promise<ApiResponse<BackupConfig>> {
    return apiClient.patch<BackupConfig>(`${PATH}/config`, patch);
  },
};
