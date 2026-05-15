import { apiClient } from "./apiClient";
import type { Character, CharacterRelation } from "@/types/project";
import type { ApiResponse } from "@/types/api";

interface CharacterListResponse {
  characters: Character[];
  relations: CharacterRelation[];
}

export const characterService = {
  async list(projectId: string): Promise<ApiResponse<CharacterListResponse>> {
    return apiClient.get<CharacterListResponse>(`/projects/${projectId}/characters`);
  },

  async getById(projectId: string, id: string): Promise<ApiResponse<{ character: Character; relations: CharacterRelation[] }>> {
    return apiClient.get<{ character: Character; relations: CharacterRelation[] }>(`/projects/${projectId}/characters/${id}`);
  },

  async create(projectId: string, data: {
    name: string;
    nickname?: string;
    roleType?: string;
    gender?: string;
    age?: string;
    appearance?: string;
    personality?: string;
    background?: string;
    abilities?: string;
    notes?: string;
  }): Promise<ApiResponse<Character>> {
    return apiClient.post<Character>(`/projects/${projectId}/characters`, data);
  },

  async update(projectId: string, id: string, data: Partial<Character>): Promise<ApiResponse<Character>> {
    return apiClient.put<Character>(`/projects/${projectId}/characters/${id}`, data);
  },

  async remove(projectId: string, id: string): Promise<ApiResponse<void>> {
    return apiClient.delete<void>(`/projects/${projectId}/characters/${id}`);
  },

  async createRelation(projectId: string, data: {
    characterAId: string;
    characterBId: string;
    relationType: string;
    description?: string;
  }): Promise<ApiResponse<CharacterRelation>> {
    return apiClient.post<CharacterRelation>(`/projects/${projectId}/characters/relations`, data);
  },

  async deleteRelation(projectId: string, relationId: string): Promise<ApiResponse<void>> {
    return apiClient.delete<void>(`/projects/${projectId}/characters/relations/${relationId}`);
  },
};
