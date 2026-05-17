import { apiClient } from "./apiClient";
import type { ApiResponse } from "@/types/api";

export const POLISH_STYLES = ['文学化', '口语化', '精简', '热血', '唯美', '幽默', '悬疑', '严肃'] as const;
export type PolishStyle = typeof POLISH_STYLES[number];

export interface PolishResult {
  polished: string;
  changes: string[];
  style_score: number;
  style: string;
}

export const aiPolishService = {
  async polish(projectId: string, text: string, style: PolishStyle, customInstruction?: string): Promise<ApiResponse<PolishResult>> {
    return apiClient.post<PolishResult>(`/projects/${projectId}/ai-polish/polish`, {
      text,
      style,
      customInstruction,
    });
  },
};
