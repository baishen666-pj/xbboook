import { userPreferenceService } from "./userPreferenceService";

export interface StyleDimensions {
  language: number;
  narrative: number;
  emotional: number;
  dialogue: number;
  description: number;
  webNovel: number;
}

export interface StyleProfile {
  dimensions: StyleDimensions;
  keywords: string[];
  summary: string;
  lastAnalyzedAt: string;
  sampleChapterIds: string[];
}

const PREF_KEY = "style_profile";
const DEFAULT_USER_ID = "default";

export const styleProfileService = {
  async getProfile(projectId: string): Promise<StyleProfile | null> {
    const prefs = await userPreferenceService.getPreferences(`${DEFAULT_USER_ID}_${projectId}`);
    const raw = prefs[PREF_KEY];
    if (!raw) return null;
    try {
      return JSON.parse(raw) as StyleProfile;
    } catch {
      return null;
    }
  },

  async saveProfile(projectId: string, profile: StyleProfile): Promise<void> {
    await userPreferenceService.updatePreferences(
      `${DEFAULT_USER_ID}_${projectId}`,
      { [PREF_KEY]: JSON.stringify(profile) }
    );
  },
};
