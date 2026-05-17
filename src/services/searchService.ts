import { apiClient } from "./apiClient";

export interface ChapterSearchResult {
  category: "chapters";
  chapterId: string;
  chapterTitle: string;
  volumeId: string | null;
  snippet: string;
  highlights: string[];
  matchStart: number;
}

export interface MetadataSearchResult {
  category: "characters" | "worldviews" | "outlines" | "foreshadowing";
  id: string;
  title: string;
  snippet: string;
  highlights: string[];
}

export type SearchResult = ChapterSearchResult | MetadataSearchResult;

export interface SearchOptions {
  categories?: string[];
  volumeId?: string;
  limit?: number;
}

export interface SearchSuggestion {
  text: string;
  category: "chapter" | "character" | "worldview" | "outline" | "foreshadowing";
  id: string;
}

export async function searchAll(
  projectId: string,
  query: string,
  options?: SearchOptions,
): Promise<SearchResult[]> {
  const res = await apiClient.post<SearchResult[]>(
    `/projects/${projectId}/search`,
    { query, ...options },
  );
  return res.data ?? [];
}

export async function getSuggestions(
  projectId: string,
  query: string,
): Promise<SearchSuggestion[]> {
  const res = await apiClient.get<SearchSuggestion[]>(
    `/projects/${projectId}/search/suggest?q=${encodeURIComponent(query)}`,
  );
  return res.data ?? [];
}

export async function reindexProject(
  projectId: string,
): Promise<{ indexed: number; errors: number }> {
  const res = await apiClient.post<{ indexed: number; errors: number }>(
    `/projects/${projectId}/search/reindex`,
    {},
  );
  return res.data ?? { indexed: 0, errors: 0 };
}

export async function getSearchStats(
  projectId: string,
): Promise<{ cached_chapters: number; total_chapters: number }> {
  const res = await apiClient.get<{
    cached_chapters: number;
    total_chapters: number;
  }>(`/projects/${projectId}/search/stats`);
  return res.data ?? { cached_chapters: 0, total_chapters: 0 };
}

export function getCategoryLabel(
  category: SearchResult["category"],
): string {
  switch (category) {
    case "chapters":
      return "章节";
    case "characters":
      return "角色";
    case "worldviews":
      return "世界观";
    case "outlines":
      return "大纲";
    case "foreshadowing":
      return "伏笔";
  }
}

export function getCategoryIcon(
  category: SearchResult["category"],
): string {
  switch (category) {
    case "chapters":
      return "M4 6h16M4 12h16M4 18h10";
    case "characters":
      return "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z";
    case "worldviews":
      return "M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064";
    case "outlines":
      return "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2";
    case "foreshadowing":
      return "M13 10V3L4 14h7v7l9-11h-7z";
  }
}

const RECENT_KEY = "xbboook_recent_searches";
const MAX_RECENT = 10;

export function getRecentSearches(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function addRecentSearch(query: string): void {
  const recent = getRecentSearches().filter((s) => s !== query);
  recent.unshift(query);
  localStorage.setItem(
    RECENT_KEY,
    JSON.stringify(recent.slice(0, MAX_RECENT)),
  );
}

export function clearRecentSearches(): void {
  localStorage.removeItem(RECENT_KEY);
}
