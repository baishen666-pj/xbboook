import { apiClient } from './apiClient';

export interface AiSkill {
  id: string;
  name: string;
  description: string;
  icon: string;
  needsSelection: boolean;
}

export interface AiProvider {
  id: string;
  name: string;
  baseUrl: string;
  defaultModel: string;
  models: string[];
}

export interface AiStatus {
  configured: boolean;
  provider: string;
  model: string;
  baseUrl: string;
  temperature: number;
  maxTokens: number;
  apiKeyHint: string;
}

export interface HistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface StreamRequest {
  projectId: string;
  skillId: string;
  chapterId?: string;
  selectedText?: string;
  targetStyle?: string;
  question?: string;
  customInstruction?: string;
  outlineContent?: string;
  historyMessages?: HistoryMessage[];
  character1Id?: string;
  character2Id?: string;
}

export async function fetchSkills(): Promise<AiSkill[]> {
  const res = await apiClient.get<AiSkill[]>('/ai/skills');
  return res.success ? res.data ?? [] : [];
}

export async function fetchProviders(): Promise<AiProvider[]> {
  const res = await apiClient.get<AiProvider[]>('/ai/providers');
  return res.success ? res.data ?? [] : [];
}

export async function fetchStatus(): Promise<AiStatus> {
  const res = await apiClient.get<AiStatus>('/ai/status');
  if (!res.success || !res.data) throw new Error(res.error || '获取 AI 状态失败');
  return res.data;
}

export async function updateAiConfig(patch: {
  provider?: string;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}): Promise<AiStatus> {
  const res = await apiClient.patch<AiStatus>('/ai/config', patch);
  if (!res.success || !res.data) throw new Error(res.error || '更新 AI 配置失败');
  return res.data;
}

export async function testConnection(): Promise<{ success: boolean; reply?: string; error?: string }> {
  const res = await apiClient.post<{ reply?: string }>('/ai/test', {});
  if (!res.success) return { success: false, error: res.error ?? undefined };
  return { success: true, reply: res.data?.reply };
}

export interface CompletionRequest {
  projectId: string;
  chapterId: string;
  cursorContext: string;
  maxTokens?: number;
}

export async function fetchCompletion(req: CompletionRequest): Promise<string> {
  const res = await apiClient.post<{ completion: string }>('/ai/complete', req);
  if (!res.success || !res.data) throw new Error(res.error || '补全失败');
  return res.data.completion;
}

export interface ContextSummary {
  genre: string | null;
  hasWorldview: boolean;
  plantedForeshadowingCount: number;
  charactersWithoutVoice: number;
  outlineNodeCount: number;
}

export async function fetchContextSummary(projectId: string): Promise<ContextSummary> {
  const res = await apiClient.get<ContextSummary>(`/ai/context-summary/${projectId}`);
  if (!res.success || !res.data) throw new Error(res.error || '获取上下文摘要失败');
  return res.data;
}

export async function* streamAi(req: StreamRequest, signal?: AbortSignal): AsyncGenerator<{ type: 'chunk' | 'done'; content: string }> {
  const response = await fetch('/api/ai/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText);
  }

  const body = response.body;
  if (!body) throw new Error('无响应内容');

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      const parts = buffer.split('\n\n');
      buffer = parts.pop() || '';

      for (const part of parts) {
        let eventType = '';
        let dataStr = '';

        for (const line of part.split('\n')) {
          if (line.startsWith('event: ')) eventType = line.slice(7);
          else if (line.startsWith('data: ')) dataStr = line.slice(6);
        }

        if (!dataStr) continue;

        try {
          const data = JSON.parse(dataStr);
          if (eventType === 'chunk' && data.content) {
            yield { type: 'chunk', content: data.content };
          } else if (eventType === 'done') {
            yield { type: 'done', content: data.content };
          } else if (eventType === 'error') {
            throw new Error(data.error || 'AI 流式响应错误');
          }
        } catch (err) {
          if (err instanceof Error && err.message.includes('AI')) throw err;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
