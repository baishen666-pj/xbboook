import { apiClient } from './apiClient';

export interface AiMemory {
  id: string;
  projectId: string;
  chapterId: string | null;
  category: string;
  title: string;
  content: string;
  importance: string;
  chapterIndex: number | null;
  isAutoExtracted: number;
  createdAt: string;
  updatedAt: string;
}

export interface MemoryStats {
  totalMemories: number;
  totalChunks: number;
  byCategory: Record<string, number>;
  byImportance: Record<string, number>;
}

export interface RagResult {
  source: string;
  sourceId: string;
  sourceType: string;
  content: string;
  relevance: number;
  tokenCount: number;
}

export const memoryService = {
  list(projectId: string, filters?: { category?: string; importance?: string }) {
    const params = new URLSearchParams();
    if (filters?.category) params.set('category', filters.category);
    if (filters?.importance) params.set('importance', filters.importance);
    const qs = params.toString();
    return apiClient.get<AiMemory[]>(`/projects/${projectId}/memory${qs ? `?${qs}` : ''}`);
  },

  stats(projectId: string) {
    return apiClient.get<MemoryStats>(`/projects/${projectId}/memory/stats`);
  },

  search(projectId: string, query: string, options?: { maxTokens?: number; maxResults?: number; includeMemory?: boolean }) {
    return apiClient.post<RagResult[]>(`/projects/${projectId}/memory/search`, { query, ...options });
  },

  create(projectId: string, data: { chapterId?: string; category: string; title: string; content: string; importance?: string; chapterIndex?: number }) {
    return apiClient.post<AiMemory>(`/projects/${projectId}/memory`, data);
  },

  update(projectId: string, memoryId: string, data: Partial<{ chapterId: string | null; category: string; title: string; content: string; importance: string; chapterIndex: number | null }>) {
    return apiClient.patch<AiMemory>(`/projects/${projectId}/memory/${memoryId}`, data);
  },

  delete(projectId: string, memoryId: string) {
    return apiClient.delete(`/projects/${projectId}/memory/${memoryId}`);
  },

  extract(projectId: string, chapterId: string) {
    return apiClient.post<{ extracted: number }>(`/projects/${projectId}/memory/extract/${chapterId}`, {});
  },

  reindex(projectId: string) {
    return apiClient.post<{ indexed: number; errors: number }>(`/projects/${projectId}/memory/reindex`, {});
  },

  clearAuto(projectId: string) {
    return apiClient.post<{ deleted: number }>(`/projects/${projectId}/memory/clear-auto`, {});
  },
};
