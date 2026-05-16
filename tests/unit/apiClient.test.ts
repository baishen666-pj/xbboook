import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Import after mock is set up
import { apiClient } from '@/services/apiClient';

function mockFetchResponse(body: unknown, status = 200, ok = true) {
  return {
    ok,
    status,
    json: vi.fn().mockResolvedValue(body),
    text: vi.fn().mockResolvedValue(typeof body === 'string' ? body : JSON.stringify(body)),
  };
}

describe('apiClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET 请求', () => {
    it('发送 GET 请求并返回成功响应', async () => {
      const mockData = { success: true, data: { id: '1', name: 'test' }, error: null };
      mockFetch.mockResolvedValue(mockFetchResponse(mockData));

      const result = await apiClient.get('/projects');

      expect(mockFetch).toHaveBeenCalledWith('/api/projects', expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
      }));
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ id: '1', name: 'test' });
    });

    it('GET 请求不包含 body', async () => {
      mockFetch.mockResolvedValue(mockFetchResponse({ success: true, data: null, error: null }));

      await apiClient.get('/test');

      const call = mockFetch.mock.calls[0][1] as RequestInit;
      expect(call.body).toBeUndefined();
    });
  });

  describe('POST 请求', () => {
    it('发送 POST 请求并附带 JSON body', async () => {
      const requestBody = { name: '新项目', genre: 'fantasy' };
      mockFetch.mockResolvedValue(mockFetchResponse({ success: true, data: { id: 'p1' }, error: null }));

      const result = await apiClient.post('/projects', requestBody);

      expect(mockFetch).toHaveBeenCalledWith('/api/projects', expect.objectContaining({
        method: 'POST',
      }));
      const call = mockFetch.mock.calls[0][1] as RequestInit;
      expect(JSON.parse(call.body as string)).toEqual(requestBody);
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ id: 'p1' });
    });
  });

  describe('PUT 请求', () => {
    it('发送 PUT 请求并附带 JSON body', async () => {
      const requestBody = { title: '更新标题' };
      mockFetch.mockResolvedValue(mockFetchResponse({ success: true, data: { id: 'ch1' }, error: null }));

      await apiClient.put('/projects/p1/chapters/ch1', requestBody);

      expect(mockFetch).toHaveBeenCalledWith('/api/projects/p1/chapters/ch1', expect.objectContaining({
        method: 'PUT',
      }));
      const call = mockFetch.mock.calls[0][1] as RequestInit;
      expect(JSON.parse(call.body as string)).toEqual(requestBody);
    });
  });

  describe('PATCH 请求', () => {
    it('发送 PATCH 请求并附带 JSON body', async () => {
      const requestBody = { status: 'published' };
      mockFetch.mockResolvedValue(mockFetchResponse({ success: true, data: { id: 'ch1' }, error: null }));

      await apiClient.patch('/test/1', requestBody);

      expect(mockFetch).toHaveBeenCalledWith('/api/test/1', expect.objectContaining({
        method: 'PATCH',
      }));
      const call = mockFetch.mock.calls[0][1] as RequestInit;
      expect(JSON.parse(call.body as string)).toEqual(requestBody);
    });
  });

  describe('DELETE 请求', () => {
    it('发送 DELETE 请求不带 body', async () => {
      mockFetch.mockResolvedValue(mockFetchResponse({ success: true, data: null, error: null }));

      await apiClient.delete('/projects/p1');

      expect(mockFetch).toHaveBeenCalledWith('/api/projects/p1', expect.objectContaining({
        method: 'DELETE',
      }));
      const call = mockFetch.mock.calls[0][1] as RequestInit;
      expect(call.body).toBeUndefined();
    });
  });

  describe('错误处理', () => {
    it('HTTP 错误状态码返回失败响应', async () => {
      mockFetch.mockResolvedValue(mockFetchResponse('Not Found', 404, false));

      const result = await apiClient.get('/nonexistent');

      expect(result.success).toBe(false);
      expect(result.data).toBeNull();
      expect(result.error).toContain('404');
    });

    it('网络错误返回失败响应', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await apiClient.get('/test');

      expect(result.success).toBe(false);
      expect(result.data).toBeNull();
      expect(result.error).toBe('Network error');
    });

    it('非 Error 类型的异常返回默认错误消息', async () => {
      mockFetch.mockRejectedValue('unknown error');

      const result = await apiClient.get('/test');

      expect(result.success).toBe(false);
      expect(result.error).toBe('网络请求失败');
    });

    it('HTTP 错误时 text() 异常也能处理', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: vi.fn().mockRejectedValue(new Error('read failed')),
        json: vi.fn(),
      });

      const result = await apiClient.get('/test');

      expect(result.success).toBe(false);
      expect(result.error).toContain('500');
    });
  });

  describe('响应格式处理', () => {
    it('处理包含 success/data 字段的标准响应', async () => {
      const mockData = { success: true, data: { name: 'test' }, error: null };
      mockFetch.mockResolvedValue(mockFetchResponse(mockData));

      const result = await apiClient.get('/test');

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ name: 'test' });
    });

    it('处理不包含 success/data 的裸数据响应', async () => {
      const mockData = { name: 'test', value: 42 };
      mockFetch.mockResolvedValue(mockFetchResponse(mockData));

      const result = await apiClient.get('/test');

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ name: 'test', value: 42 });
    });

    it('将 snake_case 键转换为 camelCase', async () => {
      const mockData = {
        success: true,
        data: { project_id: 'p1', created_at: '2026-01-01', sort_order: 1 },
        error: null,
      };
      mockFetch.mockResolvedValue(mockFetchResponse(mockData));

      const result = await apiClient.get('/test');

      expect(result.data).toEqual({ projectId: 'p1', createdAt: '2026-01-01', sortOrder: 1 });
    });

    it('递归转换嵌套对象中的 snake_case 键', async () => {
      const mockData = {
        success: true,
        data: {
          chapter_id: 'ch1',
          nested: { inner_key: 'value' },
        },
        error: null,
      };
      mockFetch.mockResolvedValue(mockFetchResponse(mockData));

      const result = await apiClient.get('/test');

      expect(result.data).toEqual({
        chapterId: 'ch1',
        nested: { innerKey: 'value' },
      });
    });

    it('递归转换数组中对象的 snake_case 键', async () => {
      const mockData = {
        success: true,
        data: [
          { item_id: '1', item_name: 'first' },
          { item_id: '2', item_name: 'second' },
        ],
        error: null,
      };
      mockFetch.mockResolvedValue(mockFetchResponse(mockData));

      const result = await apiClient.get('/test');

      expect(result.data).toEqual([
        { itemId: '1', itemName: 'first' },
        { itemId: '2', itemName: 'second' },
      ]);
    });

    it('保留 null 和原始类型不变', async () => {
      const mockData = { success: true, data: null, error: null };
      mockFetch.mockResolvedValue(mockFetchResponse(mockData));

      const result = await apiClient.get('/test');

      expect(result.data).toBeNull();
    });
  });

  describe('请求头', () => {
    it('默认包含 Content-Type: application/json', async () => {
      mockFetch.mockResolvedValue(mockFetchResponse({ success: true, data: null, error: null }));

      await apiClient.get('/test');

      const call = mockFetch.mock.calls[0][1] as RequestInit;
      expect(call.headers).toEqual(
        expect.objectContaining({ 'Content-Type': 'application/json' }),
      );
    });
  });
});
