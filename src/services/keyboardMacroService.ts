import { apiClient } from './apiClient';

export interface KeyboardMacro {
  id: string;
  projectId: string | null;
  name: string;
  description: string;
  trigger: string;
  actions: { type: string; value: string; selection?: string }[];
  enabled: boolean;
  scope: string;
}

export const keyboardMacroService = {
  list: (projectId: string) => apiClient.get<KeyboardMacro[]>(`/projects/${projectId}/macros`),
  create: (projectId: string, data: { name: string; description?: string; trigger: string; actions: { type: string; value: string }[]; scope?: string }) =>
    apiClient.post(`/projects/${projectId}/macros`, data),
  update: (projectId: string, macroId: string, data: Partial<KeyboardMacro>) =>
    apiClient.patch(`/projects/${projectId}/macros/${macroId}`, data),
  delete: (projectId: string, macroId: string) =>
    apiClient.delete(`/projects/${projectId}/macros/${macroId}`),
};
