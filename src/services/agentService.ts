const API_BASE = '/api/projects';

export interface AgentConfig {
  maxIterations: number;
  draftTargetWords: number;
  reviewStrictness: 'low' | 'medium' | 'high';
  enableSelfRevision: boolean;
  styleFingerprintId?: string;
  customInstructions?: string;
}

export interface AgentSession {
  id: string;
  project_id: string;
  chapter_id: string | null;
  status: string;
  config: string;
  current_step: string;
  draft_content: string;
  iteration: number;
  max_iterations: number;
  plan: string;
  review_notes: string;
  final_content: string;
  created_at: string;
  updated_at: string;
}

export interface AgentDecision {
  id: string;
  session_id: string;
  iteration: number;
  decision_type: string;
  input_summary: string;
  output_summary: string;
  reasoning: string;
  token_usage: number;
  created_at: string;
}

export interface AgentEvent {
  type: string;
  sessionId: string;
  data: Record<string, unknown>;
}

export async function createAgentSession(
  projectId: string,
  chapterId: string,
  config: AgentConfig,
): Promise<AgentSession> {
  const res = await fetch(`${API_BASE}/${projectId}/agent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chapterId, config }),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error);
  return json.data;
}

export async function* runAgentSession(
  projectId: string,
  sessionId: string,
  signal?: AbortSignal,
): AsyncGenerator<AgentEvent> {
  const res = await fetch(`${API_BASE}/${projectId}/agent/${sessionId}/start`, {
    method: 'POST',
    signal,
  });

  if (!res.ok) {
    const json = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(json.error || `HTTP ${res.status}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (trimmed.startsWith('event: ')) {
        continue;
      }

      if (trimmed.startsWith('data: ')) {
        try {
          const data = JSON.parse(trimmed.slice(6));
          yield { type: data.type || 'unknown', sessionId, data };
        } catch { /* skip */ }
      }
    }
  }
}

export async function pauseAgentSession(projectId: string, sessionId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/${projectId}/agent/${sessionId}/pause`, { method: 'POST' });
  const json = await res.json();
  if (!json.success) throw new Error(json.error);
}

export async function resumeAgentSession(projectId: string, sessionId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/${projectId}/agent/${sessionId}/resume`, { method: 'POST' });
  const json = await res.json();
  if (!json.success) throw new Error(json.error);
}

export async function getAgentSession(projectId: string, sessionId: string): Promise<AgentSession> {
  const res = await fetch(`${API_BASE}/${projectId}/agent/${sessionId}`);
  const json = await res.json();
  if (!json.success) throw new Error(json.error);
  return json.data;
}

export async function getAgentDecisions(projectId: string, sessionId: string): Promise<AgentDecision[]> {
  const res = await fetch(`${API_BASE}/${projectId}/agent/${sessionId}/decisions`);
  const json = await res.json();
  if (!json.success) throw new Error(json.error);
  return json.data;
}

export async function cancelAgentSession(projectId: string, sessionId: string): Promise<void> {
  await fetch(`${API_BASE}/${projectId}/agent/${sessionId}`, { method: 'DELETE' });
}
