import { apiClient } from "./apiClient";
import type { ApiResponse } from "@/types/api";

export interface OutlineExpandResult {
  created: Array<{ id: string; title: string; content: string; level: number; parentId: string; sortOrder: number }>;
  notes: string;
}

export interface OutlineTemplateResult {
  title: string;
  children: Array<{ title: string; summary: string }>;
}

export interface OutlineAnalysisResult {
  overall_score: number;
  completeness: number;
  pacing_score: number;
  conflict_density: number;
  character_arc_coverage: number;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
}

export const outlineEnhanceService = {
  async expand(projectId: string, outlineId: string, customInstruction?: string): Promise<ApiResponse<OutlineExpandResult>> {
    return apiClient.post<OutlineExpandResult>(`/projects/${projectId}/outline-enhance/expand`, {
      outlineId,
      customInstruction,
    });
  },

  async template(projectId: string, params: {
    genre: string;
    style?: string;
    premise?: string;
    targetLength?: string;
  }): Promise<ApiResponse<OutlineTemplateResult>> {
    return apiClient.post<OutlineTemplateResult>(`/projects/${projectId}/outline-enhance/template`, params);
  },

  async analyze(projectId: string, customInstruction?: string): Promise<ApiResponse<OutlineAnalysisResult>> {
    return apiClient.post<OutlineAnalysisResult>(`/projects/${projectId}/outline-enhance/analyze`, {
      customInstruction,
    });
  },
};
