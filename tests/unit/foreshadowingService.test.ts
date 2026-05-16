import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/services/apiClient', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

import { foreshadowingService } from '@/services/foreshadowingService';
import { apiClient } from '@/services/apiClient';

const mockedGet = vi.mocked(apiClient.get);
const mockedPost = vi.mocked(apiClient.post);
const mockedPatch = vi.mocked(apiClient.patch);
const mockedDelete = vi.mocked(apiClient.delete);

describe('foreshadowingService', () => {
  const projectId = 'proj-1';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchForeshadowing', () => {
    it('获取项目伏笔列表（无过滤）', async () => {
      const items = [
        { id: 'f1', title: '神秘戒指', status: 'planted' },
        { id: 'f2', title: '预言', status: 'harvested' },
      ];
      mockedGet.mockResolvedValue({ success: true, data: items, error: null });

      const result = await foreshadowingService.fetchForeshadowing(projectId);

      expect(mockedGet).toHaveBeenCalledWith(`/foreshadowing/${projectId}`);
      expect(result.data).toHaveLength(2);
    });

    it('按状态过滤伏笔', async () => {
      const items = [{ id: 'f1', title: '神秘戒指', status: 'planted' }];
      mockedGet.mockResolvedValue({ success: true, data: items, error: null });

      const result = await foreshadowingService.fetchForeshadowing(projectId, 'planted');

      expect(mockedGet).toHaveBeenCalledWith(`/foreshadowing/${projectId}?status=planted`);
      expect(result.data).toHaveLength(1);
    });

    it('返回空伏笔列表', async () => {
      mockedGet.mockResolvedValue({ success: true, data: [], error: null });

      const result = await foreshadowingService.fetchForeshadowing(projectId);

      expect(result.data).toEqual([]);
    });
  });

  describe('createForeshadowing', () => {
    it('创建伏笔并发送 title', async () => {
      const data = { title: '新的伏笔' };
      const created = { id: 'f3', ...data, status: 'planted' };
      mockedPost.mockResolvedValue({ success: true, data: created, error: null });

      const result = await foreshadowingService.createForeshadowing(projectId, data);

      expect(mockedPost).toHaveBeenCalledWith(`/foreshadowing/${projectId}`, data);
      expect(result.data!.title).toBe('新的伏笔');
    });

    it('创建时附带可选字段', async () => {
      const data = {
        title: '完整伏笔',
        description: '详细描述',
        plant_chapter_id: 'ch1',
        expected_harvest_chapter_id: 'ch10',
        importance: 'high',
      };
      mockedPost.mockResolvedValue({ success: true, data: { id: 'f4', ...data }, error: null });

      const result = await foreshadowingService.createForeshadowing(projectId, data);

      expect(mockedPost).toHaveBeenCalledWith(`/foreshadowing/${projectId}`, data);
      expect(result.data!.importance).toBe('high');
    });
  });

  describe('updateForeshadowing', () => {
    it('更新伏笔的部分字段', async () => {
      const data = { title: '更新标题', status: 'harvested' };
      const updated = { id: 'f1', ...data };
      mockedPatch.mockResolvedValue({ success: true, data: updated, error: null });

      const result = await foreshadowingService.updateForeshadowing(projectId, 'f1', data);

      expect(mockedPatch).toHaveBeenCalledWith(`/foreshadowing/${projectId}/f1`, data);
      expect(result.data!.status).toBe('harvested');
    });

    it('将 description 设为 null', async () => {
      const data = { description: null };
      mockedPatch.mockResolvedValue({ success: true, data: { id: 'f1', description: null }, error: null });

      await foreshadowingService.updateForeshadowing(projectId, 'f1', data);

      expect(mockedPatch).toHaveBeenCalledWith(`/foreshadowing/${projectId}/f1`, { description: null });
    });

    it('设置 actual_harvest_chapter_id', async () => {
      const data = { actual_harvest_chapter_id: 'ch8', status: 'harvested' };
      mockedPatch.mockResolvedValue({ success: true, data: { id: 'f1' }, error: null });

      await foreshadowingService.updateForeshadowing(projectId, 'f1', data);

      expect(mockedPatch).toHaveBeenCalledWith(`/foreshadowing/${projectId}/f1`, data);
    });
  });

  describe('deleteForeshadowing', () => {
    it('删除伏笔', async () => {
      mockedDelete.mockResolvedValue({ success: true, data: null, error: null });

      const result = await foreshadowingService.deleteForeshadowing(projectId, 'f1');

      expect(mockedDelete).toHaveBeenCalledWith(`/foreshadowing/${projectId}/f1`);
      expect(result.success).toBe(true);
    });
  });

  describe('错误处理', () => {
    it('更新不存在的伏笔返回错误', async () => {
      mockedPatch.mockResolvedValue({ success: false, data: null, error: '伏笔不存在' });

      const result = await foreshadowingService.updateForeshadowing(projectId, 'nonexistent', { title: 'x' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('伏笔不存在');
    });
  });
});
