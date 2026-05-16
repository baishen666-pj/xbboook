import { loadStoredConfig, type StoredAiConfig } from './configStore.js';

export interface StreamChunk {
  content: string;
  done: boolean;
}

export type AiConfig = StoredAiConfig;

export { isConfigured } from './configStore.js';

export function getConfig(): AiConfig {
  return loadStoredConfig();
}

export async function* streamChat(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  overrides?: Partial<Pick<AiConfig, 'model' | 'temperature' | 'maxTokens'>>,
): AsyncGenerator<StreamChunk> {
  const config = getConfig();
  const model = overrides?.model || config.model;
  const temperature = overrides?.temperature ?? config.temperature;
  const maxTokens = overrides?.maxTokens || config.maxTokens;

  const url = `${config.baseUrl.replace(/\/$/, '')}/chat/completions`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      stream: true,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    const sanitized = errorText.replace(/sk-[a-zA-Z0-9]{20,}/g, '***');
    throw new Error(`AI API error (${response.status}): ${sanitized}`);
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
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === 'data: [DONE]') {
          if (trimmed === 'data: [DONE]') {
            yield { content: '', done: true };
          }
          continue;
        }
        if (!trimmed.startsWith('data: ')) continue;

        try {
          const json = JSON.parse(trimmed.slice(6));
          const delta = json.choices?.[0]?.delta?.content;
          if (delta) {
            yield { content: delta, done: false };
          }
        } catch (e) {
          console.warn('[AI SSE] Malformed line:', trimmed, e);
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
