import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/services/apiClient', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    upload: vi.fn(),
  },
}));

import {
  fetchSkills,
  fetchProviders,
  fetchStatus,
  updateAiConfig,
  testConnection,
  streamAi,
} from '@/services/aiService';
import type { StreamRequest } from '@/services/aiService';
import { apiClient } from '@/services/apiClient';

const mockApiClient = apiClient as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  patch: ReturnType<typeof vi.fn>;
};

// streamAi still uses raw fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function successResponse<T>(data: T) {
  return { success: true, data, error: null };
}

function errorResponse(error: string) {
  return { success: false, data: null, error };
}

describe('aiService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchSkills', () => {
    it('获取 AI 技能列表', async () => {
      const skills = [
        { id: 'continue', name: '续写', description: '续写章节', icon: 'pen', needsSelection: false },
      ];
      mockApiClient.get.mockResolvedValue(successResponse(skills));

      const result = await fetchSkills();

      expect(mockApiClient.get).toHaveBeenCalledWith('/ai/skills');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('continue');
    });

    it('API 返回 null data 时返回空数组', async () => {
      mockApiClient.get.mockResolvedValue({ success: true, data: null, error: null });

      const result = await fetchSkills();

      expect(result).toEqual([]);
    });

    it('API 返回无 data 字段时返回空数组', async () => {
      mockApiClient.get.mockResolvedValue({ success: false, data: null, error: 'fail' });

      const result = await fetchSkills();

      expect(result).toEqual([]);
    });
  });

  describe('fetchProviders', () => {
    it('获取 AI 供应商列表', async () => {
      const providers = [
        { id: 'openai', name: 'OpenAI', baseUrl: 'https://api.openai.com', defaultModel: 'gpt-4', models: ['gpt-4', 'gpt-3.5'] },
      ];
      mockApiClient.get.mockResolvedValue(successResponse(providers));

      const result = await fetchProviders();

      expect(mockApiClient.get).toHaveBeenCalledWith('/ai/providers');
      expect(result[0].id).toBe('openai');
      expect(result[0].models).toHaveLength(2);
    });

    it('返回空数组', async () => {
      mockApiClient.get.mockResolvedValue(successResponse([]));

      const result = await fetchProviders();

      expect(result).toEqual([]);
    });
  });

  describe('fetchStatus', () => {
    it('获取 AI 配置状态', async () => {
      const status = {
        configured: true,
        provider: 'openai',
        model: 'gpt-4',
        baseUrl: 'https://api.openai.com',
        temperature: 0.7,
        maxTokens: 4096,
        apiKeyHint: 'sk-...abc',
      };
      mockApiClient.get.mockResolvedValue(successResponse(status));

      const result = await fetchStatus();

      expect(mockApiClient.get).toHaveBeenCalledWith('/ai/status');
      expect(result.configured).toBe(true);
      expect(result.apiKeyHint).toBe('sk-...abc');
    });
  });

  describe('updateAiConfig', () => {
    it('更新 AI 配置（PATCH）', async () => {
      const patch = { temperature: 0.5, maxTokens: 2048 };
      const updated = {
        configured: true, provider: 'openai', model: 'gpt-4',
        baseUrl: 'https://api.openai.com', temperature: 0.5, maxTokens: 2048, apiKeyHint: 'sk-...abc',
      };
      mockApiClient.patch.mockResolvedValue(successResponse(updated));

      const result = await updateAiConfig(patch);

      expect(mockApiClient.patch).toHaveBeenCalledWith('/ai/config', patch);
      expect(result.temperature).toBe(0.5);
    });

    it('切换 AI 供应商', async () => {
      const patch = { provider: 'anthropic', baseUrl: 'https://api.anthropic.com', model: 'claude-3' };
      mockApiClient.patch.mockResolvedValue(successResponse({
        configured: true, provider: 'anthropic', model: 'claude-3',
        baseUrl: 'https://api.anthropic.com', temperature: 0.7, maxTokens: 4096, apiKeyHint: '',
      }));

      const result = await updateAiConfig(patch);

      expect(result.provider).toBe('anthropic');
    });
  });

  describe('testConnection', () => {
    it('测试 AI 连接成功', async () => {
      mockApiClient.post.mockResolvedValue(successResponse({ reply: '连接正常' }));

      const result = await testConnection();

      expect(mockApiClient.post).toHaveBeenCalledWith('/ai/test', {});
      expect(result.success).toBe(true);
      expect(result.reply).toBe('连接正常');
    });

    it('测试连接失败', async () => {
      mockApiClient.post.mockResolvedValue(errorResponse('API 密钥无效'));

      const result = await testConnection();

      expect(result.success).toBe(false);
      expect(result.error).toBe('API 密钥无效');
    });
  });

  describe('streamAi', () => {
    function createMockStream(chunks: string[]) {
      const encoder = new TextEncoder();
      const encoded = chunks.map(c => encoder.encode(c));
      let index = 0;

      return {
        getReader: () => ({
          read: vi.fn().mockImplementation(() => {
            if (index < encoded.length) {
              return Promise.resolve({ done: false, value: encoded[index++] });
            }
            return Promise.resolve({ done: true, value: undefined });
          }),
          releaseLock: vi.fn(),
        }),
      };
    }

    it('解析 SSE chunk 事件', async () => {
      const req: StreamRequest = {
        projectId: 'proj-1',
        skillId: 'continue',
        chapterId: 'ch1',
      };

      const stream = createMockStream([
        'event: chunk\ndata: {"content":"你好"}\n\n',
        'event: chunk\ndata: {"content":"世界"}\n\n',
        'event: done\ndata: {"content":""}\n\n',
      ]);

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        body: stream,
      });

      const results: Array<{ type: string; content: string }> = [];
      for await (const chunk of streamAi(req)) {
        results.push(chunk);
      }

      expect(results).toHaveLength(3);
      expect(results[0]).toEqual({ type: 'chunk', content: '你好' });
      expect(results[1]).toEqual({ type: 'chunk', content: '世界' });
      expect(results[2]).toEqual({ type: 'done', content: '' });
    });

    it('HTTP 错误时抛出异常', async () => {
      const req: StreamRequest = { projectId: 'proj-1', skillId: 'continue' };
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: vi.fn().mockResolvedValue('服务器错误'),
      });

      const gen = streamAi(req);
      await expect(gen.next()).rejects.toThrow('服务器错误');
    });

    it('无响应 body 时抛出异常', async () => {
      const req: StreamRequest = { projectId: 'proj-1', skillId: 'continue' };
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        body: null,
      });

      const gen = streamAi(req);
      await expect(gen.next()).rejects.toThrow('无响应内容');
    });

    it('SSE error 事件抛出异常（包含 AI 关键字的错误）', async () => {
      const req: StreamRequest = { projectId: 'proj-1', skillId: 'continue' };
      const stream = createMockStream([
        'event: error\ndata: {"error":"AI 模型不可用"}\n\n',
      ]);

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        body: stream,
      });

      const gen = streamAi(req);
      await expect(gen.next()).rejects.toThrow('AI 模型不可用');
    });

    it('传递 AbortSignal', async () => {
      const req: StreamRequest = { projectId: 'proj-1', skillId: 'continue' };
      const controller = new AbortController();
      const stream = createMockStream([]);
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        body: stream,
      });

      for await (const _ of streamAi(req, controller.signal)) { /* drain */ }

      const call = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(call[1].signal).toBe(controller.signal);
    });
  });
});
