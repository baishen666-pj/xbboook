import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { getProvider, PROVIDERS } from './providers.js';

export interface StoredAiConfig {
  provider: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  temperature: number;
  maxTokens: number;
}

const CONFIG_PATH = join(process.cwd(), 'data', 'ai-config.json');

const DEFAULTS: Omit<StoredAiConfig, 'apiKey'> = {
  provider: 'deepseek',
  baseUrl: 'https://api.deepseek.com/v1',
  model: 'deepseek-chat',
  temperature: 0.8,
  maxTokens: 4096,
};

function readFile(): Partial<StoredAiConfig> {
  try {
    if (existsSync(CONFIG_PATH)) {
      const raw = readFileSync(CONFIG_PATH, 'utf-8');
      return JSON.parse(raw);
    }
  } catch {
    // ignore read errors
  }
  return {};
}

function writeFile(config: StoredAiConfig): void {
  const dir = join(process.cwd(), 'data');
  if (!existsSync(dir)) {
    writeFileSync(dir + '/.gitkeep', '');
  }
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
}

export function loadStoredConfig(): StoredAiConfig {
  const file = readFile();
  const envApiKey = process.env.AI_API_KEY || '';
  const envBaseUrl = process.env.AI_BASE_URL || '';
  const envModel = process.env.AI_MODEL || '';

  // Priority: file > env > defaults
  const apiKey = file.apiKey || envApiKey;
  let provider = file.provider || DEFAULTS.provider;
  let baseUrl = file.baseUrl || envBaseUrl || DEFAULTS.baseUrl;
  let model = file.model || envModel || DEFAULTS.model;

  // If env sets base/model, infer provider
  if (envBaseUrl && !file.baseUrl) {
    for (const p of PROVIDERS) {
      if (p.baseUrl && envBaseUrl.startsWith(p.baseUrl.replace('/v1', ''))) {
        provider = p.id;
        break;
      }
    }
  }

  return {
    provider,
    apiKey,
    baseUrl,
    model,
    temperature: file.temperature ?? DEFAULTS.temperature,
    maxTokens: file.maxTokens ?? DEFAULTS.maxTokens,
  };
}

export function saveConfig(patch: Partial<StoredAiConfig>): StoredAiConfig {
  const current = loadStoredConfig();
  const updated = { ...current, ...patch };

  // When provider changes, update baseUrl and model to defaults
  if (patch.provider && patch.provider !== current.provider) {
    const preset = getProvider(patch.provider);
    if (preset && preset.id !== 'custom') {
      updated.baseUrl = patch.baseUrl || preset.baseUrl;
      updated.model = patch.model || preset.defaultModel;
    }
  }

  writeFile(updated);
  return updated;
}

export function isConfigured(): boolean {
  return !!loadStoredConfig().apiKey;
}
