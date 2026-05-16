import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/services/apiClient', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import { commentService } from '@/services/commentService';
import { apiClient } from '@/services/apiClient';

const mockedGet = vi.mocked(apiClient.get);
const mockedPost = vi.mocked(apiClient.post);
const mockedPut = vi.mocked(apiClient.put);
const mockedDelete = vi.mocked(apiClient.delete);

describe('commentService', () => {
  const projectId = 'proj-1';
  const chapterId = 'ch-1';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getComments', () => {
    it('获取章节评论列表', async () => {
      const comments = [
        { id: 'cm1', content: '这段写得不错', userId: 'u1' },
        { id: 'cm2', content: '需要修改', userId: 'u2' },
      ];
      mockedGet.mockResolvedValue({ success: true, data: comments, error: null });

      const result = await commentService.getComments(projectId, chapterId);

      expect(mockedGet).toHaveBeenCalledWith(
        `/projects/${projectId}/chapters/${chapterId}/comments`,
      );
      expect(result.data).toHaveLength(2);
    });

    it('返回空评论列表', async () => {
      mockedGet.mockResolvedValue({ success: true, data: [], error: null });

      const result = await commentService.getComments(projectId, chapterId);

      expect(result.data).toEqual([]);
    });
  });

  describe('create', () => {
    it('创建纯文本评论', async () => {
      const data = { content: '新的评论', userId: 'u1' };
      const created = { id: 'cm3', ...data, resolved: false };
      mockedPost.mockResolvedValue({ success: true, data: created, error: null });

      const result = await commentService.create(projectId, chapterId, data);

      expect(mockedPost).toHaveBeenCalledWith(
        `/projects/${projectId}/chapters/${chapterId}/comments`,
        data,
      );
      expect(result.data!.id).toBe('cm3');
    });

    it('创建带选区信息的评论', async () => {
      const data = {
        content: '选区评论',
        userId: 'u1',
        selectionFrom: 10,
        selectionTo: 50,
        selectionText: '被选中的文字',
      };
      mockedPost.mockResolvedValue({ success: true, data: { id: 'cm4', ...data }, error: null });

      const result = await commentService.create(projectId, chapterId, data);

      expect(mockedPost).toHaveBeenCalledWith(
        `/projects/${projectId}/chapters/${chapterId}/comments`,
        data,
      );
    });

    it('创建评论时选区字段可选', async () => {
      const data = { content: '无选区', userId: 'u1' };
      mockedPost.mockResolvedValue({ success: true, data: { id: 'cm5' }, error: null });

      await commentService.create(projectId, chapterId, data);

      const callData = mockedPost.mock.calls[0][1] as Record<string, unknown>;
      expect(callData.selectionFrom).toBeUndefined();
      expect(callData.selectionTo).toBeUndefined();
    });
  });

  describe('update', () => {
    it('更新评论内容', async () => {
      const updated = { id: 'cm1', content: '修改后的评论' };
      mockedPut.mockResolvedValue({ success: true, data: updated, error: null });

      const result = await commentService.update(projectId, chapterId, 'cm1', '修改后的评论');

      expect(mockedPut).toHaveBeenCalledWith(
        `/projects/${projectId}/chapters/${chapterId}/comments/cm1`,
        { content: '修改后的评论' },
      );
      expect(result.data!.content).toBe('修改后的评论');
    });
  });

  describe('resolve', () => {
    it('标记评论为已解决', async () => {
      const resolved = { id: 'cm1', content: '评论', resolved: true };
      mockedPut.mockResolvedValue({ success: true, data: resolved, error: null });

      const result = await commentService.resolve(projectId, chapterId, 'cm1');

      expect(mockedPut).toHaveBeenCalledWith(
        `/projects/${projectId}/chapters/${chapterId}/comments/cm1/resolve`,
        {},
      );
      expect(result.data!.resolved).toBe(true);
    });

    it('resolve 请求体为空对象', async () => {
      mockedPut.mockResolvedValue({ success: true, data: { id: 'cm1' }, error: null });

      await commentService.resolve(projectId, chapterId, 'cm1');

      const body = mockedPut.mock.calls[0][1];
      expect(body).toEqual({});
    });
  });

  describe('remove', () => {
    it('删除评论', async () => {
      mockedDelete.mockResolvedValue({ success: true, data: null, error: null });

      const result = await commentService.remove(projectId, chapterId, 'cm1');

      expect(mockedDelete).toHaveBeenCalledWith(
        `/projects/${projectId}/chapters/${chapterId}/comments/cm1`,
      );
      expect(result.success).toBe(true);
    });
  });

  describe('错误处理', () => {
    it('删除不存在的评论返回错误', async () => {
      mockedDelete.mockResolvedValue({ success: false, data: null, error: '评论不存在' });

      const result = await commentService.remove(projectId, chapterId, 'nonexistent');

      expect(result.success).toBe(false);
      expect(result.error).toBe('评论不存在');
    });
  });
});
