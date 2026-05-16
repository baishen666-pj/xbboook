import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/services/apiClient', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

import { chapterService } from '@/services/chapterService';
import { apiClient } from '@/services/apiClient';

const mockedGet = vi.mocked(apiClient.get);
const mockedPost = vi.mocked(apiClient.post);
const mockedPut = vi.mocked(apiClient.put);
const mockedPatch = vi.mocked(apiClient.patch);
const mockedDelete = vi.mocked(apiClient.delete);

describe('chapterService', () => {
  const projectId = 'proj-1';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('list', () => {
    it('获取项目下所有章节列表', async () => {
      const chapters = [{ id: 'ch1', title: '第一章' }, { id: 'ch2', title: '第二章' }];
      mockedGet.mockResolvedValue({ success: true, data: chapters, error: null });

      const result = await chapterService.list(projectId);

      expect(mockedGet).toHaveBeenCalledWith(`/projects/${projectId}/chapters`);
      expect(result.data).toEqual(chapters);
    });
  });

  describe('getById', () => {
    it('获取单个章节详情', async () => {
      const chapter = { id: 'ch1', title: '第一章', content: '内容' };
      mockedGet.mockResolvedValue({ success: true, data: chapter, error: null });

      const result = await chapterService.getById(projectId, 'ch1');

      expect(mockedGet).toHaveBeenCalledWith(`/projects/${projectId}/chapters/ch1`);
      expect(result.data).toEqual(chapter);
    });
  });

  describe('create', () => {
    it('创建新章节并发送 volumeId 和 title', async () => {
      const data = { volumeId: 'v1', title: '新章节', sortOrder: 3 };
      const created = { id: 'ch3', ...data };
      mockedPost.mockResolvedValue({ success: true, data: created, error: null });

      const result = await chapterService.create(projectId, data);

      expect(mockedPost).toHaveBeenCalledWith(`/projects/${projectId}/chapters`, data);
      expect(result.data).toEqual(created);
    });

    it('创建章节时 sortOrder 可选', async () => {
      const data = { volumeId: 'v1', title: '无排序' };
      mockedPost.mockResolvedValue({ success: true, data: { id: 'ch4', ...data }, error: null });

      await chapterService.create(projectId, data);

      expect(mockedPost).toHaveBeenCalledWith(`/projects/${projectId}/chapters`, data);
    });
  });

  describe('update', () => {
    it('更新章节的 title 和 status', async () => {
      const data = { title: '更新标题', status: 'done' };
      const updated = { id: 'ch1', ...data };
      mockedPut.mockResolvedValue({ success: true, data: updated, error: null });

      const result = await chapterService.update(projectId, 'ch1', data);

      expect(mockedPut).toHaveBeenCalledWith(`/projects/${projectId}/chapters/ch1`, data);
      expect(result.data).toEqual(updated);
    });

    it('更新章节的 publishStatus 和 scheduledAt', async () => {
      const data = { publishStatus: 'scheduled', scheduledAt: '2026-06-01T00:00:00Z' };
      mockedPut.mockResolvedValue({ success: true, data: { id: 'ch1', ...data }, error: null });

      await chapterService.update(projectId, 'ch1', data);

      expect(mockedPut).toHaveBeenCalledWith(`/projects/${projectId}/chapters/ch1`, data);
    });
  });

  describe('saveContent', () => {
    it('保存章节内容并发送 { content } 请求体', async () => {
      const content = '这是章节的正文内容...';
      mockedPut.mockResolvedValue({ success: true, data: { id: 'ch1' }, error: null });

      await chapterService.saveContent(projectId, 'ch1', content);

      expect(mockedPut).toHaveBeenCalledWith(
        `/projects/${projectId}/chapters/ch1/content`,
        { content },
      );
    });
  });

  describe('remove', () => {
    it('删除章节', async () => {
      mockedDelete.mockResolvedValue({ success: true, data: null, error: null });

      const result = await chapterService.remove(projectId, 'ch1');

      expect(mockedDelete).toHaveBeenCalledWith(`/projects/${projectId}/chapters/ch1`);
      expect(result.success).toBe(true);
    });
  });

  describe('reorder', () => {
    it('批量重排章节顺序', async () => {
      const items = [
        { id: 'ch1', volumeId: 'v1', sortOrder: 0 },
        { id: 'ch2', volumeId: 'v1', sortOrder: 1 },
        { id: 'ch3', volumeId: null, sortOrder: 2 },
      ];
      mockedPut.mockResolvedValue({ success: true, data: null, error: null });

      await chapterService.reorder(projectId, items);

      expect(mockedPut).toHaveBeenCalledWith(
        `/projects/${projectId}/chapters/reorder`,
        { items },
      );
    });
  });

  describe('fetchSchedule', () => {
    it('获取章节发布计划', async () => {
      const schedule = [{ chapterId: 'ch1', scheduledAt: '2026-06-01' }];
      mockedGet.mockResolvedValue({ success: true, data: schedule, error: null });

      const result = await chapterService.fetchSchedule(projectId);

      expect(mockedGet).toHaveBeenCalledWith(`/projects/${projectId}/chapters/schedule`);
      expect(result.data).toEqual(schedule);
    });
  });

  describe('updatePublishStatus', () => {
    it('更新章节发布状态为 published', async () => {
      const data = { publish_status: 'published' as const };
      const updated = { id: 'ch1', publishStatus: 'published' };
      mockedPatch.mockResolvedValue({ success: true, data: updated, error: null });

      const result = await chapterService.updatePublishStatus(projectId, 'ch1', data);

      expect(mockedPatch).toHaveBeenCalledWith(
        `/projects/${projectId}/chapters/ch1/publish-status`,
        data,
      );
      expect(result.data).toEqual(updated);
    });

    it('更新发布状态为 scheduled 并附带 scheduled_at', async () => {
      const data = { publish_status: 'scheduled' as const, scheduled_at: '2026-06-01T10:00:00Z' };
      mockedPatch.mockResolvedValue({ success: true, data: { id: 'ch1' }, error: null });

      await chapterService.updatePublishStatus(projectId, 'ch1', data);

      expect(mockedPatch).toHaveBeenCalledWith(
        `/projects/${projectId}/chapters/ch1/publish-status`,
        data,
      );
    });

    it('scheduled_at 为 null 时取消定时发布', async () => {
      const data = { publish_status: 'draft' as const, scheduled_at: null };
      mockedPatch.mockResolvedValue({ success: true, data: { id: 'ch1' }, error: null });

      await chapterService.updatePublishStatus(projectId, 'ch1', data);

      expect(mockedPatch).toHaveBeenCalledWith(
        `/projects/${projectId}/chapters/ch1/publish-status`,
        { publish_status: 'draft', scheduled_at: null },
      );
    });
  });

  describe('错误处理', () => {
    it('API 返回错误时传递错误信息', async () => {
      mockedGet.mockResolvedValue({ success: false, data: null, error: '服务器错误' });

      const result = await chapterService.list(projectId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('服务器错误');
    });
  });
});
