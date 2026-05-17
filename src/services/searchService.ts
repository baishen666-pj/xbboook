import { apiClient } from "./apiClient";

export interface ChapterSearchResult {
  category: "chapters";
  chapterId: string;
  chapterTitle: string;
  snippet: string;
  matchStart: number;
}

export interface MetadataSearchResult {
  category: "characters" | "worldviews" | "outlines" | "foreshadowing";
  id: string;
  title: string;
  snippet: string;
}

export type SearchResult = ChapterSearchResult | MetadataSearchResult;

export async function searchAll(projectId: string, query: string): Promise<SearchResult[]> {
  const res = await apiClient.post<SearchResult[]>(
    `/projects/${projectId}/search`,
    { query }
  );
  return res.data ?? [];
}

export function getCategoryLabel(category: SearchResult["category"]): string {
  switch (category) {
    case "chapters": return "章节";
    case "characters": return "角色";
    case "worldviews": return "世界观";
    case "outlines": return "大纲";
    case "foreshadowing": return "伏笔";
  }
}
