export type WritingMode = "webnovel" | "literary" | "script";

export interface Project {
  id: string;
  name: string;
  genre: string;
  description: string;
  writingMode: WritingMode;
  wordCount: number;
  chapterCount: number;
  dailyTarget: number;
  createdAt: string;
  updatedAt: string;
}

export interface Volume {
  id: string;
  projectId: string;
  title: string;
  sortOrder: number;
  createdAt: string;
}

export type PublishStatus = "draft" | "scheduled" | "published" | "archived";

export interface Chapter {
  id: string;
  volumeId: string;
  projectId: string;
  title: string;
  content: string;
  wordCount: number;
  sortOrder: number;
  status: "draft" | "writing" | "revised" | "done";
  publishStatus: PublishStatus;
  scheduledAt: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Character {
  id: string;
  projectId: string;
  name: string;
  nickname: string | null;
  roleType: string;
  gender: string | null;
  age: string | null;
  appearance: string | null;
  personality: string | null;
  background: string | null;
  abilities: string | null;
  notes: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  speechStyle: string | null;
  verbalTics: string | null;
  vocabularyLevel: string;
  sentenceLengthPref: string;
  emotionalExpressiveness: string;
  voiceExamples: string | null;
}

export interface CharacterRelation {
  id: string;
  projectId: string;
  characterAId: string;
  characterBId: string;
  relationType: string;
  description: string | null;
  createdAt: string;
}

export interface Worldview {
  id: string;
  projectId: string;
  category: string;
  title: string;
  content: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface Outline {
  id: string;
  projectId: string;
  level: number;
  parentId: string | null;
  targetRefId: string | null;
  title: string;
  content: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface DailyStat {
  id: string;
  projectId: string;
  date: string;
  wordsAdded: number;
  wordsTotal: number;
  writingTimeMs: number;
  chaptersWorked: number;
}

export interface StatsSummary {
  totalWords: number;
  totalDays: number;
  avgDaily: number;
  bestDay: { date: string; words: number } | null;
}

export interface ChapterVersion {
  id: string;
  chapterId: string;
  projectId: string;
  versionNumber: number;
  contentHash: string;
  wordCount: number;
  snapshotType: "auto" | "manual" | "rollback";
  label: string | null;
  createdAt: string;
  content?: string;
}

export interface TemplateNode {
  title: string;
  content?: string;
  level: number;
}

export interface OutlineTemplate {
  id: string;
  name: string;
  genre: string;
  description: string | null;
  isBuiltin: number;
  sourceProjectId: string | null;
  structure: string;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardData {
  summary: StatsSummary;
  velocity: { date: string; words: number; sessions: number }[];
  chapterStatus: { status: string; count: number }[];
  streak: { current: number; longest: number };
  target: { target: number; current: number; percentage: number };
  peakHours: { hour: number; count: number }[];
}

export interface CharacterAppearance {
  name: string;
  count: number;
}

export interface WritingSession {
  id: string;
  projectId: string;
  chapterId: string;
  startedAt: string;
  endedAt: string | null;
  wordsStart: number;
  wordsEnd: number;
  durationMs: number;
}

export interface CollabUser {
  id: string;
  username: string;
  displayName: string;
  avatarColor: string;
}

export interface OnlineUser {
  userId: string;
  displayName: string;
  avatarColor: string;
}

export interface ChapterLock {
  chapterId: string;
  userId: string;
  displayName: string;
  lockedAt: string;
}

export interface ChapterComment {
  id: string;
  chapterId: string;
  projectId: string;
  userId: string;
  content: string;
  selectionFrom: number | null;
  selectionTo: number | null;
  selectionText: string | null;
  resolved: number;
  createdAt: string;
  updatedAt: string;
  displayName: string;
  avatarColor: string;
}

export interface ScheduleItem {
  id: string;
  title: string;
  wordCount: number;
  publishStatus: PublishStatus;
  scheduledAt: string | null;
  sortOrder: number;
}

export type ForeshadowingStatus = "planted" | "harvested" | "forgotten";
export type ForeshadowingImportance = "critical" | "important" | "normal" | "minor";

export interface Foreshadowing {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  plantChapterId: string | null;
  expectedHarvestChapterId: string | null;
  actualHarvestChapterId: string | null;
  status: ForeshadowingStatus;
  importance: ForeshadowingImportance;
  createdAt: string;
  updatedAt: string;
}

export type ConsistencyIssueType = 'character_conflict' | 'timeline_error' | 'setting_conflict' | 'plot_logic' | 'detail_omission' | 'foreshadowing_conflict' | 'name_mismatch';
export type ConsistencySeverity = 'critical' | 'high' | 'medium' | 'low';
export type ConsistencyStatus = 'open' | 'acknowledged' | 'fixed' | 'dismissed';
export type ConsistencySource = 'ai' | 'name_scanner' | 'manual';

export interface ConsistencyIssue {
  id: string;
  projectId: string;
  chapterId: string | null;
  type: ConsistencyIssueType;
  severity: ConsistencySeverity;
  title: string;
  description: string;
  suggestion: string;
  status: ConsistencyStatus;
  source: ConsistencySource;
  createdAt: string;
  updatedAt: string;
}

export type SnippetCategory = 'fight' | 'environment' | 'emotion' | 'dialogue' | 'transition' | 'custom';

export interface SnippetTemplate {
  id: number;
  projectId: string | null;
  name: string;
  category: SnippetCategory;
  content: string;
  isBuiltin: number;
  sortOrder: number;
  createdAt: string;
}

export type SceneStatus = 'draft' | 'writing' | 'revising' | 'done';

export interface Scene {
  id: string;
  chapterId: string;
  projectId: string;
  title: string;
  summary: string;
  contentStartOffset: number;
  contentEndOffset: number;
  tags: string[];
  mood: string;
  location: string;
  timeOfDay: string;
  povCharacterId: string | null;
  sortOrder: number;
  status: SceneStatus;
  wordCount: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface SceneWithPov extends Scene {
  povName: string | null;
}

export interface SceneStats {
  total: number;
  byStatus: Record<string, number>;
  totalWords: number;
  byMood: Record<string, number>;
}
