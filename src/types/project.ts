export type WritingMode = "webnovel" | "literary" | "script";

export interface Project {
  id: string;
  name: string;
  genre: string;
  description: string;
  writingMode: WritingMode;
  wordCount: number;
  chapterCount: number;
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

export interface Chapter {
  id: string;
  volumeId: string;
  projectId: string;
  title: string;
  content: string;
  wordCount: number;
  sortOrder: number;
  status: "draft" | "writing" | "revised" | "done";
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
