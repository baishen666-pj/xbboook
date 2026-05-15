export interface AiConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
}

export interface StreamChunk {
  content: string;
  done: boolean;
}

const DEFAULT_CONFIG: Partial<AiConfig> = {
  maxTokens: 4096,
  temperature: 0.8,
};

function loadConfig(): AiConfig {
  const baseUrl = process.env.AI_BASE_URL || 'https://api.openai.com/v1';
  const apiKey = process.env.AI_API_KEY || '';
  const model = process.env.AI_MODEL || 'gpt-4o-mini';

  if (!apiKey) {
    console.warn('[AI] AI_API_KEY not set — AI features will be unavailable');
  }

  return { ...DEFAULT_CONFIG, baseUrl, apiKey, model } as AiConfig;
}

let cachedConfig: AiConfig | null = null;

export function getConfig(): AiConfig {
  if (!cachedConfig) cachedConfig = loadConfig();
  return cachedConfig;
}

export function updateConfig(patch: Partial<AiConfig>): AiConfig {
  const current = getConfig();
  cachedConfig = { ...current, ...patch };
  return cachedConfig;
}

export function isConfigured(): boolean {
  return !!getConfig().apiKey;
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
    throw new Error(`AI API error (${response.status}): ${errorText}`);
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
}

export async function chatOnce(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  overrides?: Partial<Pick<AiConfig, 'model' | 'temperature' | 'maxTokens'>>,
): Promise<string> {
  const chunks: string[] = [];
  for await (const chunk of streamChat(messages, overrides)) {
    if (chunk.content) chunks.push(chunk.content);
  }
  return chunks.join('');
}
