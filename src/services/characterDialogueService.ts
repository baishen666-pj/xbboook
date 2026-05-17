import { apiClient } from "./apiClient";
import type { ApiResponse } from "@/types/api";

export interface DialogueLine {
  speaker: string;
  line: string;
  action: string;
}

export interface DialogueResult {
  dialogue: DialogueLine[];
  scene_description: string;
}

export const characterDialogueService = {
  async simulate(projectId: string, params: {
    characterIds: string[];
    scene: string;
    mood?: string;
    customInstruction?: string;
  }): Promise<ApiResponse<DialogueResult>> {
    return apiClient.post<DialogueResult>(`/projects/${projectId}/character-dialogue/simulate`, params);
  },
};
