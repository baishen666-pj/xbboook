import { apiClient } from './apiClient';

export interface EarnedAchievement {
  id: string;
  badgeType: string;
  earnedAt: string;
  metadata: string | null;
}

export interface BadgeDefinition {
  type: string;
  name: string;
  description: string;
  icon: string;
}

export interface AchievementData {
  earned: EarnedAchievement[];
  definitions: BadgeDefinition[];
}

export async function fetchAchievements(projectId: string): Promise<AchievementData | null> {
  const res = await apiClient.get<AchievementData>(`/projects/${projectId}/achievements`);
  return res.success ? res.data : null;
}
