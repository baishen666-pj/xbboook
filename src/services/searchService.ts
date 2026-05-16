import { apiClient } from "./apiClient";

export interface SearchResult {
  chapterId: string;
  chapterTitle: string;
  snippet: string;
  matchStart: number;
}

export async function searchChapters(projectId: string, query: string): Promise<SearchResult[]> {
  const res = await apiClient.post<SearchResult[]>(
    `/projects/${projectId}/chapters/search`,
    { query }
  );
  return res.data ?? [];
}
