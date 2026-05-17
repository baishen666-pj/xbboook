import { apiClient } from "./apiClient";
import type { ApiResponse } from "@/types/api";

export const LORE_TYPES = ['character-cards', 'relationship-map', 'worldview-summary', 'full-bible'] as const;
export type LoreType = typeof LORE_TYPES[number];

export const LORE_TYPE_LABELS: Record<string, string> = {
  'character-cards': '人物卡片',
  'relationship-map': '关系图谱',
  'worldview-summary': '世界观摘要',
  'full-bible': '设定圣经',
};

export const loreGeneratorService = {
  async generate(projectId: string, type: LoreType, characterIds?: string[], customInstruction?: string): Promise<ApiResponse<any>> {
    return apiClient.post<any>(`/projects/${projectId}/lore-generator/generate`, {
      type,
      characterIds,
      customInstruction,
    });
  },
};
