import { loadStoredConfig, getProviderConfigById, type StoredAiConfig } from './configStore.js';

export interface StreamChunk {
  content: string;
  done: boolean;
}

export type AiConfig = StoredAiConfig;

export { isConfigured } from './configStore.js';

function sanitizeApiKey(text: string): string {
  return text
    .replace(/sk-[a-zA-Z0-9]{20,}/g, '***')
    .replace(/key-[a-zA-Z0-9]{20,}/g, '***')
    .replace(/dify-[a-zA-Z0-9]{20,}/g, '***')
    .replace(/(?:Bearer\s*)?[a-f0-9]{32,}/gi, '***')
    .replace(/(?:Bearer\s*)?[A-Za-z0-9+_/-]{40,}/g, (m) => m.startsWith('Bearer ') ? m : '***');
}

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;
const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);

function isRetryableError(error: unknown): boolean {
  if (error instanceof TypeError && error.message === 'fetch failed') return true;
  if (error instanceof Error) {
    const msg = error.message;
    if (msg.includes('ECONNREFUSED') || msg.includes('ECONNRESET') || msg.includes('ETIMEDOUT')) return true;
    if (msg.includes('abort')) return false;
  }
  return false;
}

function resolveConfig(providerId?: string): { baseUrl: string; apiKey: string; model: string; temperature: number; maxTokens: number } {
  if (providerId) {
    const pc = getProviderConfigById(providerId);
    if (pc) {
      const global = loadStoredConfig();
      return {
        baseUrl: pc.baseUrl,
        apiKey: pc.apiKey,
        model: pc.model,
        temperature: global.temperature,
        maxTokens: global.maxTokens,
      };
    }
  }
  return loadStoredConfig();
}

export function getConfig(): AiConfig {
  return loadStoredConfig();
}

export async function* streamChat(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  overrides?: Partial<Pick<AiConfig, 'model' | 'temperature' | 'maxTokens'>> & { providerId?: string },
): AsyncGenerator<StreamChunk> {
  const config = resolveConfig(overrides?.providerId);
  const model = overrides?.model || config.model;
  const temperature = overrides?.temperature ?? config.temperature;
  const maxTokens = overrides?.maxTokens || config.maxTokens;

  const url = `${config.baseUrl.replace(/\/$/, '')}/chat/completions`;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (config.apiKey) headers['Authorization'] = `Bearer ${config.apiKey}`;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120_000);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model,
          messages,
          temperature,
          max_tokens: maxTokens,
          stream: true,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        const sanitized = sanitizeApiKey(errorText);

        if (RETRYABLE_STATUS_CODES.has(response.status) && attempt < MAX_RETRIES) {
          lastError = new Error(`AI API error (${response.status}): ${sanitized}`);
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
          continue;
        }

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
            } catch {
                // skip malformed SSE lines
              }
          }
        }
      } finally {
        reader.releaseLock();
      }

      return;
    } catch (err) {
      if (isRetryableError(err) && attempt < MAX_RETRIES) {
        lastError = err instanceof Error ? err : new Error(String(err));
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
        continue;
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError || new Error('All retry attempts failed');
}

export async function completeChat(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  overrides?: { maxTokens?: number; temperature?: number; providerId?: string },
): Promise<string> {
  const config = resolveConfig(overrides?.providerId);
  const url = `${config.baseUrl.replace(/\/$/, '')}/chat/completions`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (config.apiKey) headers['Authorization'] = `Bearer ${config.apiKey}`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: config.model,
        messages,
        temperature: overrides?.temperature ?? 0.7,
        max_tokens: overrides?.maxTokens ?? 200,
        stream: false,
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`AI API error (${response.status}): ${errorText.slice(0, 200)}`);
    }
    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    return data.choices?.[0]?.message?.content || '';
  } finally {
    clearTimeout(timeout);
  }
}
