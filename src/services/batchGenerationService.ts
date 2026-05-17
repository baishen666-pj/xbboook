import { apiClient } from './apiClient';

export interface BatchPlanChapter {
  outlineNodeId: string;
  title: string;
  synopsis: string;
  sortOrder: number;
}

export interface BatchPlan {
  chapters: BatchPlanChapter[];
  projectId: string;
  temperature: number;
}

export interface BatchJob {
  id: string;
  projectId: string;
  planJson: string;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  progressJson: string;
  currentChapterIndex: number;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BatchProgressEvent {
  type: 'chapter_start' | 'chapter_progress' | 'chapter_done' | 'consistency_check' | 'chapter_revise' | 'batch_done' | 'batch_error';
  chapterIndex: number;
  chapterTitle: string;
  data?: unknown;
}

export const batchGenerationService = {
  async generatePlan(projectId: string, options?: { temperature?: number }): Promise<BatchPlan> {
    const res = await apiClient.post<BatchPlan>(
      `/projects/${projectId}/batch-generation/plan`,
      { temperature: options?.temperature },
    );
    if (!res.success || !res.data) throw new Error(res.error || 'Failed to generate plan');
    return res.data;
  },

  async getStatus(projectId: string): Promise<BatchJob | null> {
    const res = await apiClient.get<BatchJob | null>(
      `/projects/${projectId}/batch-generation/status`,
    );
    if (!res.success) throw new Error(res.error || 'Failed to get status');
    return res.data;
  },

  async pause(projectId: string, jobId: string): Promise<BatchJob> {
    const res = await apiClient.post<BatchJob>(
      `/projects/${projectId}/batch-generation/pause`,
      { jobId },
    );
    if (!res.success || !res.data) throw new Error(res.error || 'Failed to pause');
    return res.data;
  },

  async cancel(projectId: string, batchId: string): Promise<void> {
    await apiClient.delete(`/projects/${projectId}/batch-generation/${batchId}`);
  },

  executeStream(
    projectId: string,
    plan: BatchPlan,
    jobId?: string,
    onEvent?: (event: BatchProgressEvent) => void,
    onError?: (err: string) => void,
    onDone?: () => void,
  ): { abort: () => void } {
    const controller = new AbortController();

    const url = `/api/projects/${projectId}/batch-generation/execute`;

    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan, jobId }),
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) {
          res.json().then((j) => {
            onError?.(j.error || `HTTP ${res.status}`);
          }).catch(() => {
            onError?.(`HTTP ${res.status}`);
          });
          return;
        }

        const reader = res.body?.getReader();
        if (!reader) {
          onError?.('No response body');
          return;
        }

        const decoder = new TextDecoder();
        let buffer = '';
        let currentEvent = '';

        function processLines(): void {
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            if (trimmed.startsWith('event: ')) {
              currentEvent = trimmed.slice(7);
              continue;
            }

            if (trimmed.startsWith('data: ')) {
              try {
                const data = JSON.parse(trimmed.slice(6));
                if (currentEvent === 'done') {
                  onDone?.();
                  return;
                }
                if (currentEvent === 'error') {
                  onError?.(data.error || 'Unknown error');
                  return;
                }
                onEvent?.(data as BatchProgressEvent);
              } catch {
                // skip malformed data
              }
            }
          }
        }

        function read(): void {
          reader!.read().then(({ done, value }) => {
            if (done) {
              onDone?.();
              return;
            }
            buffer += decoder.decode(value, { stream: true });
            processLines();
            read();
          }).catch((err) => {
            if (!controller.signal.aborted) {
              onError?.(err instanceof Error ? err.message : 'Stream read error');
            }
          });
        }

        read();
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          onError?.(err instanceof Error ? err.message : 'Request failed');
        }
      });

    return {
      abort: () => controller.abort(),
    };
  },
};
