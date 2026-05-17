import { create } from "zustand";
import { userPreferenceService } from "@/services/userPreferenceService";

interface PreferenceState {
  userId: string | null;
  preferences: Record<string, string>;
  isLoaded: boolean;
}

interface PreferenceActions {
  loadPreferences: (userId: string) => Promise<void>;
  setPreference: (key: string, value: string) => void;
  getPreference: (key: string, fallback?: string) => string | undefined;
  clear: () => void;
}

export const usePreferenceStore = create<PreferenceState & PreferenceActions>((set, get) => ({
  userId: null,
  preferences: {},
  isLoaded: false,

  loadPreferences: async (userId) => {
    try {
      const prefs = await userPreferenceService.getPreferences(userId);
      set({ userId, preferences: prefs, isLoaded: true });
    } catch {
      set({ userId, isLoaded: true });
    }
  },

  setPreference: (key, value) => {
    const { userId, preferences } = get();
    set({ preferences: { ...preferences, [key]: value } });
    // Persist in background
    if (userId) {
      userPreferenceService.updatePreferences(userId, { [key]: value }).catch(() => {});
    }
  },

  getPreference: (key, fallback) => {
    const { preferences } = get();
    if (key in preferences) return preferences[key];
    return fallback;
  },

  clear: () => set({ userId: null, preferences: {}, isLoaded: false }),
}));
