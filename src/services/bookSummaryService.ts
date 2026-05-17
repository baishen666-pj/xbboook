import { apiClient } from './apiClient';
import type { ApiResponse } from '@/types/api';

export const bookSummaryService = {
  generate: (projectId: string, data: {
    level?: string; chapterIds?: string[]; focus?: string;
  }): Promise<ApiResponse<{
    book_summary: string;
    volume_summaries: { range: string; summary: string; key_events: string[] }[];
    character_arcs: { name: string; arc: string }[];
    worldview_changes: string[];
    plot_threads: { thread: string; status: string; chapters: number[] }[];
    timeline_gaps: string[];
    coherence_score: number;
  }>> => apiClient.post(`/projects/${projectId}/book-summary/generate`, data),
};
