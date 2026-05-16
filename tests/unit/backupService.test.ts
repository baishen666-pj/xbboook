import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/services/apiClient', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

import { backupService } from '@/services/backupService';
import { apiClient } from '@/services/apiClient';

const mockedGet = vi.mocked(apiClient.get);
const mockedPost = vi.mocked(apiClient.post);
const mockedPatch = vi.mocked(apiClient.patch);
const mockedDelete = vi.mocked(apiClient.delete);

describe('backupService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listBackups', () => {
    it('获取备份列表', async () => {
      const backups = [
        { id: 'b1', createdAt: '2026-05-16T10:00:00Z', sizeBytes: 1024000 },
        { id: 'b2', createdAt: '2026-05-15T10:00:00Z', sizeBytes: 980000 },
      ];
      mockedGet.mockResolvedValue({ success: true, data: backups, error: null });

      const result = await backupService.listBackups();

      expect(mockedGet).toHaveBeenCalledWith('/backups');
      expect(result.data).toHaveLength(2);
      expect(result.data![0].sizeBytes).toBe(1024000);
    });

    it('返回空备份列表', async () => {
      mockedGet.mockResolvedValue({ success: true, data: [], error: null });

      const result = await backupService.listBackups();

      expect(result.data).toEqual([]);
    });
  });

  describe('createBackup', () => {
    it('创建新备份', async () => {
      const created = { id: 'b3', createdAt: '2026-05-17T10:00:00Z', sizeBytes: 0 };
      mockedPost.mockResolvedValue({ success: true, data: created, error: null });

      const result = await backupService.createBackup();

      expect(mockedPost).toHaveBeenCalledWith('/backups', {});
      expect(result.data!.id).toBe('b3');
    });

    it('创建备份请求体为空对象', async () => {
      mockedPost.mockResolvedValue({ success: true, data: { id: 'b3' }, error: null });

      await backupService.createBackup();

      const body = mockedPost.mock.calls[0][1];
      expect(body).toEqual({});
    });
  });

  describe('deleteBackup', () => {
    it('删除指定备份', async () => {
      mockedDelete.mockResolvedValue({ success: true, data: null, error: null });

      const result = await backupService.deleteBackup('b1');

      expect(mockedDelete).toHaveBeenCalledWith('/backups/b1');
      expect(result.success).toBe(true);
    });
  });

  describe('getConfig', () => {
    it('获取备份配置', async () => {
      const config = { enabled: true, intervalHours: 24, keepCount: 10 };
      mockedGet.mockResolvedValue({ success: true, data: config, error: null });

      const result = await backupService.getConfig();

      expect(mockedGet).toHaveBeenCalledWith('/backups/config');
      expect(result.data!.enabled).toBe(true);
      expect(result.data!.intervalHours).toBe(24);
      expect(result.data!.keepCount).toBe(10);
    });
  });

  describe('updateConfig', () => {
    it('更新备份配置的 enabled 字段', async () => {
      const patch = { enabled: false };
      const updated = { enabled: false, intervalHours: 24, keepCount: 10 };
      mockedPatch.mockResolvedValue({ success: true, data: updated, error: null });

      const result = await backupService.updateConfig(patch);

      expect(mockedPatch).toHaveBeenCalledWith('/backups/config', patch);
      expect(result.data!.enabled).toBe(false);
    });

    it('更新备份配置的 intervalHours', async () => {
      const patch = { intervalHours: 12 };
      mockedPatch.mockResolvedValue({ success: true, data: { enabled: true, intervalHours: 12, keepCount: 10 }, error: null });

      const result = await backupService.updateConfig(patch);

      expect(mockedPatch).toHaveBeenCalledWith('/backups/config', { intervalHours: 12 });
      expect(result.data!.intervalHours).toBe(12);
    });

    it('更新备份配置的 keepCount', async () => {
      const patch = { keepCount: 20 };
      mockedPatch.mockResolvedValue({ success: true, data: { enabled: true, intervalHours: 24, keepCount: 20 }, error: null });

      const result = await backupService.updateConfig(patch);

      expect(mockedPatch).toHaveBeenCalledWith('/backups/config', { keepCount: 20 });
      expect(result.data!.keepCount).toBe(20);
    });

    it('同时更新多个配置字段', async () => {
      const patch = { enabled: true, intervalHours: 6, keepCount: 30 };
      mockedPatch.mockResolvedValue({ success: true, data: patch, error: null });

      const result = await backupService.updateConfig(patch);

      expect(mockedPatch).toHaveBeenCalledWith('/backups/config', patch);
      expect(result.data!.intervalHours).toBe(6);
    });
  });

  describe('错误处理', () => {
    it('获取配置失败时传递错误', async () => {
      mockedGet.mockResolvedValue({ success: false, data: null, error: '配置读取失败' });

      const result = await backupService.getConfig();

      expect(result.success).toBe(false);
      expect(result.error).toBe('配置读取失败');
    });

    it('创建备份失败时传递错误', async () => {
      mockedPost.mockResolvedValue({ success: false, data: null, error: '磁盘空间不足' });

      const result = await backupService.createBackup();

      expect(result.success).toBe(false);
      expect(result.error).toBe('磁盘空间不足');
    });

    it('删除不存在的备份返回错误', async () => {
      mockedDelete.mockResolvedValue({ success: false, data: null, error: '备份不存在' });

      const result = await backupService.deleteBackup('nonexistent');

      expect(result.success).toBe(false);
      expect(result.error).toBe('备份不存在');
    });
  });
});
