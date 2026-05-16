import { describe, it, expect, vi, beforeEach } from 'vitest';

// aiService uses global fetch directly (not apiClient), so mock fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import {
  fetchSkills,
  fetchProviders,
  fetchStatus,
  updateAiConfig,
  testConnection,
  streamAi,
} from '@/services/aiService';
import type { StreamRequest } from '@/services/aiService';

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(body),
    text: vi.fn().mockResolvedValue(typeof body === 'string' ? body : JSON.stringify(body)),
  };
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
      mockFetch.mockResolvedValue(jsonResponse({ data: skills }));

      const result = await fetchSkills();

      expect(mockFetch).toHaveBeenCalledWith('/api/ai/skills');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('continue');
    });

    it('API 返回 null data 时返回空数组', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ data: null }));

      const result = await fetchSkills();

      expect(result).toEqual([]);
    });

    it('API 返回无 data 字段时返回空数组', async () => {
      mockFetch.mockResolvedValue(jsonResponse({}));

      const result = await fetchSkills();

      expect(result).toEqual([]);
    });
  });

  describe('fetchProviders', () => {
    it('获取 AI 供应商列表', async () => {
      const providers = [
        { id: 'openai', name: 'OpenAI', baseUrl: 'https://api.openai.com', defaultModel: 'gpt-4', models: ['gpt-4', 'gpt-3.5'] },
      ];
      mockFetch.mockResolvedValue(jsonResponse({ data: providers }));

      const result = await fetchProviders();

      expect(mockFetch).toHaveBeenCalledWith('/api/ai/providers');
      expect(result[0].id).toBe('openai');
      expect(result[0].models).toHaveLength(2);
    });

    it('返回空数组', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ data: [] }));

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
      mockFetch.mockResolvedValue(jsonResponse({ data: status }));

      const result = await fetchStatus();

      expect(mockFetch).toHaveBeenCalledWith('/api/ai/status');
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
      mockFetch.mockResolvedValue(jsonResponse({ data: updated }));

      const result = await updateAiConfig(patch);

      expect(mockFetch).toHaveBeenCalledWith('/api/ai/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      expect(result.temperature).toBe(0.5);
    });

    it('更新 API 密钥', async () => {
      const patch = { apiKey: 'sk-new-key' };
      mockFetch.mockResolvedValue(jsonResponse({
        data: {
          configured: true, provider: 'openai', model: 'gpt-4',
          baseUrl: '', temperature: 0.7, maxTokens: 4096, apiKeyHint: 'sk-...key',
        },
      }));

      await updateAiConfig(patch);

      const call = mockFetch.mock.calls[0][1] as RequestInit;
      expect(JSON.parse(call.body as string)).toEqual({ apiKey: 'sk-new-key' });
    });

    it('切换 AI 供应商', async () => {
      const patch = { provider: 'anthropic', baseUrl: 'https://api.anthropic.com', model: 'claude-3' };
      mockFetch.mockResolvedValue(jsonResponse({
        data: {
          configured: true, provider: 'anthropic', model: 'claude-3',
          baseUrl: 'https://api.anthropic.com', temperature: 0.7, maxTokens: 4096, apiKeyHint: '',
        },
      }));

      const result = await updateAiConfig(patch);

      expect(result.provider).toBe('anthropic');
    });
  });

  describe('testConnection', () => {
    it('测试 AI 连接成功', async () => {
      const response = { success: true, reply: '连接正常' };
      mockFetch.mockResolvedValue(jsonResponse(response));

      const result = await testConnection();

      expect(mockFetch).toHaveBeenCalledWith('/api/ai/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      expect(result.success).toBe(true);
      expect(result.reply).toBe('连接正常');
    });

    it('测试连接失败', async () => {
      const response = { success: false, error: 'API 密钥无效' };
      mockFetch.mockResolvedValue(jsonResponse(response));

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

      // streamAi is an async generator; the first .next() triggers the throw
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

    it('SSE error 事件不含 AI 关键字时被静默跳过', async () => {
      const req: StreamRequest = { projectId: 'proj-1', skillId: 'continue' };
      const stream = createMockStream([
        'event: chunk\ndata: {"content":"正常内容"}\n\n',
        'event: error\ndata: {"error":"模型不可用"}\n\n',
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

      // The error without 'AI' keyword is silently skipped
      expect(results).toHaveLength(1);
      expect(results[0].content).toBe('正常内容');
    });

    it('正确传递请求参数', async () => {
      const req: StreamRequest = {
        projectId: 'proj-1',
        skillId: 'rewrite',
        chapterId: 'ch1',
        selectedText: '选中的文本',
        targetStyle: '文学',
        question: '如何修改',
        customInstruction: '保持简洁',
      };

      const stream = createMockStream([]);
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        body: stream,
      });

      // consume generator
      for await (const _ of streamAi(req)) { /* drain */ }

      const call = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(call[0]).toBe('/api/ai/stream');
      expect(call[1].method).toBe('POST');
      expect(JSON.parse(call[1].body as string)).toEqual(req);
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

    it('传递 historyMessages', async () => {
      const req: StreamRequest = {
        projectId: 'proj-1',
        skillId: 'chat',
        historyMessages: [
          { role: 'user', content: '你好' },
          { role: 'assistant', content: '你好，有什么可以帮助你的？' },
        ],
      };
      const stream = createMockStream([]);
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        body: stream,
      });

      for await (const _ of streamAi(req)) { /* drain */ }

      const call = mockFetch.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(call[1].body as string);
      expect(body.historyMessages).toHaveLength(2);
    });

    it('传递角色对话参数', async () => {
      const req: StreamRequest = {
        projectId: 'proj-1',
        skillId: 'dialogue',
        character1Id: 'c1',
        character2Id: 'c2',
      };
      const stream = createMockStream([]);
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        body: stream,
      });

      for await (const _ of streamAi(req)) { /* drain */ }

      const call = mockFetch.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(call[1].body as string);
      expect(body.character1Id).toBe('c1');
      expect(body.character2Id).toBe('c2');
    });

    it('跳过无法解析的 SSE 事件', async () => {
      const req: StreamRequest = { projectId: 'proj-1', skillId: 'continue' };
      const stream = createMockStream([
        'event: chunk\ndata: {"content":"有效"}\n\n',
        'data: invalid json\n\n',
        'event: chunk\ndata: {"content":"继续"}\n\n',
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

      // Should only yield the two valid chunk events
      expect(results).toHaveLength(2);
      expect(results[0].content).toBe('有效');
      expect(results[1].content).toBe('继续');
    });
  });
});
