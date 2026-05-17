import { apiClient } from "./apiClient";

export interface ContextSourceInfo {
  label: string;
  description: string;
  estimatedTokens: number;
  enabled: boolean;
}

export interface ContextInfo {
  sources: ContextSourceInfo[];
  maxTokens: number;
  usedTokens: number;
  budgetPercentage: number;
}

export const contextConfigService = {
  getContextInfo(projectId: string, disabledSources?: string[]) {
    const params = disabledSources?.length
      ? `?disabledSources=${disabledSources.join(",")}`
      : "";
    return apiClient.get<ContextInfo>(
      `/ai/projects/${projectId}/context-info${params}`
    );
  },
};
