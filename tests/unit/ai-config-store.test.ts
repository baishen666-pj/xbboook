import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { mockReadFileSync, mockWriteFileSync, mockExistsSync } = vi.hoisted(() => ({
  mockReadFileSync: vi.fn(),
  mockWriteFileSync: vi.fn(),
  mockExistsSync: vi.fn(),
}));

vi.mock('node:fs', () => ({
  readFileSync: mockReadFileSync,
  writeFileSync: mockWriteFileSync,
  existsSync: mockExistsSync,
}));

vi.mock('node:path', () => ({
  join: (...args: string[]) => args.join('/'),
}));

vi.mock('../../server/ai/providers.js', () => ({
  getProvider: vi.fn((id: string) => {
    const providers: Record<string, { id: string; baseUrl: string; defaultModel: string }> = {
      deepseek: { id: 'deepseek', baseUrl: 'https://api.deepseek.com/v1', defaultModel: 'deepseek-chat' },
      qwen: { id: 'qwen', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', defaultModel: 'qwen-plus' },
      openai: { id: 'openai', baseUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-4o-mini' },
      custom: { id: 'custom', baseUrl: '', defaultModel: '' },
    };
    return providers[id];
  }),
  PROVIDERS: [
    { id: 'deepseek', baseUrl: 'https://api.deepseek.com/v1' },
    { id: 'qwen', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1' },
    { id: 'openai', baseUrl: 'https://api.openai.com/v1' },
    { id: 'custom', baseUrl: '' },
  ],
}));

import { loadStoredConfig, saveConfig, isConfigured } from '../../server/ai/configStore.js';

describe('configStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.AI_API_KEY;
    delete process.env.AI_BASE_URL;
    delete process.env.AI_MODEL;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.AI_API_KEY;
    delete process.env.AI_BASE_URL;
    delete process.env.AI_MODEL;
  });

  describe('loadStoredConfig', () => {
    it('文件不存在时返回默认配置', () => {
      mockExistsSync.mockReturnValue(false);

      const config = loadStoredConfig();

      expect(config.provider).toBe('deepseek');
      expect(config.baseUrl).toBe('https://api.deepseek.com/v1');
      expect(config.model).toBe('deepseek-chat');
      expect(config.temperature).toBe(0.8);
      expect(config.maxTokens).toBe(4096);
      expect(config.apiKey).toBe('');
    });

    it('从文件读取已保存的配置', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(
        JSON.stringify({
          provider: 'qwen',
          apiKey: 'sk-test-key',
          baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
          model: 'qwen-plus',
          temperature: 0.7,
          maxTokens: 8192,
        }),
      );

      const config = loadStoredConfig();

      expect(config.provider).toBe('qwen');
      expect(config.apiKey).toBe('sk-test-key');
      expect(config.model).toBe('qwen-plus');
      expect(config.temperature).toBe(0.7);
      expect(config.maxTokens).toBe(8192);
    });

    it('文件读取失败时返回默认配置', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const config = loadStoredConfig();

      expect(config.provider).toBe('deepseek');
    });

    it('文件 JSON 解析失败时返回默认配置', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('invalid json {{{');

      const config = loadStoredConfig();

      expect(config.provider).toBe('deepseek');
    });

    it('环境变量 API_KEY 作为后备', () => {
      mockExistsSync.mockReturnValue(false);
      process.env.AI_API_KEY = 'env-key-123';

      const config = loadStoredConfig();

      expect(config.apiKey).toBe('env-key-123');
    });

    it('环境变量 BASE_URL 和 MODEL 作为后备', () => {
      mockExistsSync.mockReturnValue(false);
      process.env.AI_BASE_URL = 'https://custom.api.com/v1';
      process.env.AI_MODEL = 'custom-model';

      const config = loadStoredConfig();

      expect(config.baseUrl).toBe('https://custom.api.com/v1');
      expect(config.model).toBe('custom-model');
    });

    it('文件配置优先于环境变量', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(
        JSON.stringify({ apiKey: 'file-key', baseUrl: 'https://file.url/v1', model: 'file-model' }),
      );
      process.env.AI_API_KEY = 'env-key';
      process.env.AI_BASE_URL = 'https://env.url/v1';
      process.env.AI_MODEL = 'env-model';

      const config = loadStoredConfig();

      expect(config.apiKey).toBe('file-key');
      expect(config.baseUrl).toBe('https://file.url/v1');
      expect(config.model).toBe('file-model');
    });

    it('文件中部分字段缺失时使用默认值填充', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(
        JSON.stringify({ apiKey: 'test-key' }),
      );

      const config = loadStoredConfig();

      expect(config.apiKey).toBe('test-key');
      expect(config.temperature).toBe(0.8);
      expect(config.maxTokens).toBe(4096);
    });

    it('环境变量 BASE_URL 可推断 provider', () => {
      mockExistsSync.mockReturnValue(false);
      process.env.AI_BASE_URL = 'https://api.openai.com/v1';

      const config = loadStoredConfig();

      expect(config.provider).toBe('openai');
    });
  });

  describe('saveConfig', () => {
    it('保存部分配置合并到当前配置', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(
        JSON.stringify({
          provider: 'deepseek',
          apiKey: 'original-key',
          baseUrl: 'https://api.deepseek.com/v1',
          model: 'deepseek-chat',
          temperature: 0.8,
          maxTokens: 4096,
        }),
      );

      const result = saveConfig({ temperature: 0.5, maxTokens: 2048 });

      expect(result.temperature).toBe(0.5);
      expect(result.maxTokens).toBe(2048);
      expect(result.apiKey).toBe('original-key');
      expect(mockWriteFileSync).toHaveBeenCalled();
    });

    it('切换 provider 时自动更新 baseUrl 和 model', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(
        JSON.stringify({
          provider: 'deepseek',
          apiKey: 'test-key',
          baseUrl: 'https://api.deepseek.com/v1',
          model: 'deepseek-chat',
          temperature: 0.8,
          maxTokens: 4096,
        }),
      );

      const result = saveConfig({ provider: 'qwen' });

      expect(result.provider).toBe('qwen');
      expect(result.baseUrl).toBe('https://dashscope.aliyuncs.com/compatible-mode/v1');
      expect(result.model).toBe('qwen-plus');
    });

    it('切换到 custom provider 时不自动更新 baseUrl', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(
        JSON.stringify({
          provider: 'deepseek',
          apiKey: 'test-key',
          baseUrl: 'https://api.deepseek.com/v1',
          model: 'deepseek-chat',
          temperature: 0.8,
          maxTokens: 4096,
        }),
      );

      const result = saveConfig({ provider: 'custom' });

      expect(result.provider).toBe('custom');
      // custom provider has empty baseUrl/defaultModel, so they stay from current
      expect(result.baseUrl).toBe('https://api.deepseek.com/v1');
    });

    it('切换 provider 时允许手动指定 baseUrl 和 model', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(
        JSON.stringify({
          provider: 'deepseek',
          apiKey: 'test-key',
          baseUrl: 'https://api.deepseek.com/v1',
          model: 'deepseek-chat',
          temperature: 0.8,
          maxTokens: 4096,
        }),
      );

      const result = saveConfig({
        provider: 'openai',
        baseUrl: 'https://custom-proxy.com/v1',
        model: 'gpt-4o',
      });

      expect(result.provider).toBe('openai');
      expect(result.baseUrl).toBe('https://custom-proxy.com/v1');
      expect(result.model).toBe('gpt-4o');
    });

    it('保存 apiKey', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(
        JSON.stringify({
          provider: 'deepseek',
          apiKey: '',
          baseUrl: 'https://api.deepseek.com/v1',
          model: 'deepseek-chat',
          temperature: 0.8,
          maxTokens: 4096,
        }),
      );

      const result = saveConfig({ apiKey: 'new-api-key' });

      expect(result.apiKey).toBe('new-api-key');
    });
  });

  describe('isConfigured', () => {
    it('有 apiKey 时返回 true', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(
        JSON.stringify({ apiKey: 'sk-configured' }),
      );

      expect(isConfigured()).toBe(true);
    });

    it('无 apiKey 时返回 false', () => {
      mockExistsSync.mockReturnValue(false);

      expect(isConfigured()).toBe(false);
    });

    it('空字符串 apiKey 视为未配置', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(
        JSON.stringify({ apiKey: '' }),
      );

      expect(isConfigured()).toBe(false);
    });

    it('环境变量 apiKey 也算已配置', () => {
      mockExistsSync.mockReturnValue(false);
      process.env.AI_API_KEY = 'env-key';

      expect(isConfigured()).toBe(true);
    });
  });
});
