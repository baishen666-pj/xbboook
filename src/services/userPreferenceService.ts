import { apiClient } from "./apiClient";

export const userPreferenceService = {
  async getPreferences(userId: string): Promise<Record<string, string>> {
    const res = await apiClient.get<Record<string, string>>(`/users/${userId}/preferences`);
    return res.success && res.data ? res.data : {};
  },

  async updatePreferences(userId: string, prefs: Record<string, string>): Promise<Record<string, string>> {
    const res = await apiClient.patch<Record<string, string>>(`/users/${userId}/preferences`, { preferences: prefs });
    return res.success && res.data ? res.data : {};
  },
};
