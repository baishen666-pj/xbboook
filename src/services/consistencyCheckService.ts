import { apiClient } from "./apiClient";
import type { ApiResponse } from "@/types/api";

export interface ConsistencyIssue {
  type: string;
  severity: string;
  location: string;
  description: string;
  suggestion: string;
}

export interface ConsistencyResult {
  issues: ConsistencyIssue[];
  summary: string;
  consistency_score: number;
}

export const consistencyCheckService = {
  async check(projectId: string, customInstruction?: string): Promise<ApiResponse<ConsistencyResult>> {
    return apiClient.post<ConsistencyResult>(`/projects/${projectId}/consistency/check`, {
      customInstruction,
    });
  },
};
