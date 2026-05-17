import { apiClient } from "./apiClient";
import type { ApiResponse } from "@/types/api";

export const DIRECTIONS = ['continue', 'dialogue', 'action', 'description', 'emotion'] as const;
export type CompleteDirection = typeof DIRECTIONS[number];

export const DIRECTION_LABELS: Record<string, string> = {
  continue: '自然续写', dialogue: '对话', action: '动作', description: '描写', emotion: '情感',
};

export interface CompleteResult {
  completion: string;
  direction: string;
}

export const smartCompleteService = {
  async complete(projectId: string, text: string, direction?: CompleteDirection, maxWords?: number, customInstruction?: string): Promise<ApiResponse<CompleteResult>> {
    return apiClient.post<CompleteResult>(`/projects/${projectId}/smart-complete/complete`, {
      text,
      direction,
      maxWords,
      customInstruction,
    });
  },
};
