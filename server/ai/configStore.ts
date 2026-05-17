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

export interface ProviderConfig {
  id: string;
  name: string;
  provider: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  isActive: boolean;
}

const CONFIG_PATH = join(process.cwd(), 'data', 'ai-config.json');
const PROVIDERS_PATH = join(process.cwd(), 'data', 'ai-providers.json');

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
  } catch (err) {
    console.warn('[configStore] Failed to read config file:', err instanceof Error ? err.message : err);
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

function readProvidersFile(): ProviderConfig[] {
  try {
    if (existsSync(PROVIDERS_PATH)) {
      const raw = readFileSync(PROVIDERS_PATH, 'utf-8');
      return JSON.parse(raw);
    }
  } catch { /* empty */ }
  return [];
}

function writeProvidersFile(providers: ProviderConfig[]): void {
  writeFileSync(PROVIDERS_PATH, JSON.stringify(providers, null, 2), 'utf-8');
}

export function loadStoredConfig(): StoredAiConfig {
  const file = readFile();
  const envApiKey = process.env.AI_API_KEY || '';
  const envBaseUrl = process.env.AI_BASE_URL || '';
  const envModel = process.env.AI_MODEL || '';

  const apiKey = file.apiKey || envApiKey;
  let provider = file.provider || DEFAULTS.provider;
  let baseUrl = file.baseUrl || envBaseUrl || DEFAULTS.baseUrl;
  let model = file.model || envModel || DEFAULTS.model;

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

  if (patch.provider && patch.provider !== current.provider) {
    const preset = getProvider(patch.provider);
    if (preset && preset.id !== 'custom' && preset.id !== 'ollama') {
      updated.baseUrl = patch.baseUrl || preset.baseUrl;
      updated.model = patch.model || preset.defaultModel;
    }
    if (preset && preset.id === 'ollama') {
      updated.baseUrl = patch.baseUrl || preset.baseUrl;
      updated.model = patch.model || preset.defaultModel;
    }
  }

  writeFile(updated);
  return updated;
}

export function isConfigured(): boolean {
  // Ollama doesn't need an API key
  const config = loadStoredConfig();
  if (config.provider === 'ollama') return !!config.baseUrl;
  return !!config.apiKey;
}

// --- Multi-provider support ---

export function getProviderConfigs(): ProviderConfig[] {
  const providers = readProvidersFile();

  // Auto-migrate: if providers list is empty but single config exists, create one
  if (providers.length === 0) {
    const single = loadStoredConfig();
    if (single.apiKey || single.provider === 'ollama') {
      const migrated: ProviderConfig = {
        id: 'default',
        name: getProvider(single.provider)?.name || single.provider,
        provider: single.provider,
        apiKey: single.apiKey,
        baseUrl: single.baseUrl,
        model: single.model,
        isActive: true,
      };
      writeProvidersFile([migrated]);
      return [migrated];
    }
  }

  return providers;
}

export function saveProviderConfigs(providers: ProviderConfig[]): ProviderConfig[] {
  // Ensure exactly one is active
  const hasActive = providers.some(p => p.isActive);
  if (!hasActive && providers.length > 0) {
    providers[0]!.isActive = true;
  }

  writeProvidersFile(providers);

  // Sync the active provider to single config for backward compatibility
  const active = providers.find(p => p.isActive);
  if (active) {
    writeFile({
      provider: active.provider,
      apiKey: active.apiKey,
      baseUrl: active.baseUrl,
      model: active.model,
      temperature: loadStoredConfig().temperature,
      maxTokens: loadStoredConfig().maxTokens,
    });
  }

  return providers;
}

export function getActiveProviderConfig(): ProviderConfig | null {
  const providers = getProviderConfigs();
  return providers.find(p => p.isActive) || providers[0] || null;
}

export function setActiveProvider(id: string): ProviderConfig[] {
  const providers = getProviderConfigs();
  for (const p of providers) {
    p.isActive = p.id === id;
  }
  return saveProviderConfigs(providers);
}

export function getProviderConfigById(id: string): ProviderConfig | null {
  return getProviderConfigs().find(p => p.id === id) || null;
}
