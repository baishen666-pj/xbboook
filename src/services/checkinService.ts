import { apiClient } from './apiClient';

export interface CheckinDay {
  date: string;
  wordsToday: number;
  note?: string | null;
}

export interface CheckinStats {
  totalCheckIns: number;
  totalWords: number;
  currentStreak: number;
  longestStreak: number;
}

export interface CheckinResponse {
  checkIn: { id: string; date: string; wordsToday: number };
  newAchievements: Array<{ badgeType: string }>;
}

export async function fetchCalendar(projectId: string, year: number): Promise<CheckinDay[]> {
  const res = await apiClient.get<CheckinDay[]>(`/projects/${projectId}/checkins/calendar?year=${year}`);
  return res.success ? res.data ?? [] : [];
}

export async function fetchCheckinStats(projectId: string): Promise<CheckinStats | null> {
  const res = await apiClient.get<CheckinStats>(`/projects/${projectId}/checkins/stats`);
  return res.success ? res.data : null;
}

export async function createCheckin(projectId: string, note?: string): Promise<CheckinResponse | null> {
  const res = await apiClient.post<CheckinResponse>(`/projects/${projectId}/checkins`, { note: note || undefined });
  return res.success ? res.data : null;
}
