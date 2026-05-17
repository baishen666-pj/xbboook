import { apiClient } from "./apiClient";
import type { ApiResponse } from "@/types/api";

export interface VoiceStyleResult {
  rewritten: string;
  voice_traits: string[];
  match_score: number;
  characterName: string;
}

export const voiceStyleService = {
  async rewrite(projectId: string, characterId: string, text: string, customInstruction?: string): Promise<ApiResponse<VoiceStyleResult>> {
    return apiClient.post<VoiceStyleResult>(`/projects/${projectId}/voice-style/rewrite`, {
      characterId,
      text,
      customInstruction,
    });
  },
};
