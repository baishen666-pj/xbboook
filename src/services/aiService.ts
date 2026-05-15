export interface AiSkill {
  id: string;
  name: string;
  description: string;
  icon: string;
  needsSelection: boolean;
}

export interface AiStatus {
  configured: boolean;
  model: string;
}

export interface StreamRequest {
  projectId: string;
  skillId: string;
  chapterId?: string;
  selectedText?: string;
  targetStyle?: string;
  question?: string;
  customInstruction?: string;
}

export async function fetchSkills(): Promise<AiSkill[]> {
  const res = await fetch('/api/ai/skills');
  const json = await res.json();
  return json.data ?? [];
}

export async function fetchStatus(): Promise<AiStatus> {
  const res = await fetch('/api/ai/status');
  const json = await res.json();
  return json.data;
}

export async function fetchAiConfig(): Promise<{ model: string; temperature: number; maxTokens: number }> {
  const res = await fetch('/api/ai/status');
  const json = await res.json();
  return json.data;
}

export async function updateAiConfig(patch: { model?: string; temperature?: number; maxTokens?: number }): Promise<void> {
  await fetch('/api/ai/config', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
}

export async function* streamAi(req: StreamRequest): AsyncGenerator<{ type: 'chunk' | 'done'; content: string }> {
  const response = await fetch('/api/ai/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText);
  }

  const body = response.body;
  if (!body) throw new Error('No response body');

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
            throw new Error(data.error || 'AI stream error');
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
