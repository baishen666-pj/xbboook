import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'path';

const {
  mockExistsSync,
  mockMkdirSync,
  mockCopyFileSync,
  mockCpSync,
  mockReaddirSync,
  mockStatSync,
  mockRmSync,
  mockReadFileSync,
  mockWriteFileSync,
} = vi.hoisted(() => ({
  mockExistsSync: vi.fn(),
  mockMkdirSync: vi.fn(),
  mockCopyFileSync: vi.fn(),
  mockCpSync: vi.fn(),
  mockReaddirSync: vi.fn(),
  mockStatSync: vi.fn(),
  mockRmSync: vi.fn(),
  mockReadFileSync: vi.fn(),
  mockWriteFileSync: vi.fn(),
}));

vi.mock('fs', () => ({
  default: {
    existsSync: mockExistsSync,
    mkdirSync: mockMkdirSync,
    copyFileSync: mockCopyFileSync,
    cpSync: mockCpSync,
    readdirSync: mockReaddirSync,
    statSync: mockStatSync,
    rmSync: mockRmSync,
    readFileSync: mockReadFileSync,
    writeFileSync: mockWriteFileSync,
  },
  existsSync: mockExistsSync,
  mkdirSync: mockMkdirSync,
  copyFileSync: mockCopyFileSync,
  cpSync: mockCpSync,
  readdirSync: mockReaddirSync,
  statSync: mockStatSync,
  rmSync: mockRmSync,
  readFileSync: mockReadFileSync,
  writeFileSync: mockWriteFileSync,
}));

import {
  createBackup,
  listBackups,
  deleteBackup,
  cleanupOldBackups,
  getBackupConfig,
  setBackupConfig,
} from '../../server/services/backupService.js';

describe('backupService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-17T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('createBackup', () => {
    it('创建备份目录并复制数据库文件', () => {
      mockExistsSync.mockImplementation((p: unknown) => {
        const path = String(p);
        if (path.endsWith('novel-pen.db')) return true;
        if (path.endsWith('projects') && path.includes('data')) return false;
        if (path.endsWith('backups')) return true;
        return false;
      });
      mockReaddirSync.mockReturnValue([]);
      mockStatSync.mockReturnValue({ size: 1024 } as any);

      const info = createBackup();

      expect(info).toBeDefined();
      expect(info.id).toBeTruthy();
      expect(info.createdAt).toBeTruthy();
      expect(info.sizeBytes).toBeGreaterThanOrEqual(0);
      expect(mockCopyFileSync).toHaveBeenCalled();
    });

    it('同时复制项目目录', () => {
      mockExistsSync.mockImplementation((p: unknown) => {
        const path = String(p);
        if (path.endsWith('novel-pen.db')) return true;
        if (path.endsWith('projects') && path.includes('data')) return true;
        if (path.endsWith('backups')) return true;
        return false;
      });
      mockReaddirSync.mockReturnValue([]);
      mockStatSync.mockReturnValue({ size: 2048 } as any);

      createBackup();

      expect(mockCpSync).toHaveBeenCalled();
    });

    it('数据库文件不存在时跳过复制', () => {
      mockExistsSync.mockImplementation((p: unknown) => {
        const path = String(p);
        if (path.endsWith('novel-pen.db')) return false;
        if (path.endsWith('backups')) return true;
        return false;
      });
      mockReaddirSync.mockReturnValue([]);

      createBackup();

      expect(mockCopyFileSync).not.toHaveBeenCalled();
    });

    it('自动创建备份目录', () => {
      let mkdirCalled = false;
      mockExistsSync.mockImplementation((p: unknown) => {
        const path = String(p);
        if (path.endsWith('backups')) {
          if (!mkdirCalled) {
            mkdirCalled = true;
            return false;
          }
          return true;
        }
        return false;
      });
      mockMkdirSync.mockImplementation(() => '');
      mockReaddirSync.mockReturnValue([]);

      createBackup();

      expect(mockMkdirSync).toHaveBeenCalled();
    });
  });

  describe('listBackups', () => {
    it('列出所有备份按 id 降序排列', () => {
      mockExistsSync.mockReturnValue(true);

      // First call: readdirSync on backups dir
      mockReaddirSync.mockImplementation((dirPath: unknown) => {
        const p = String(dirPath);
        // Top-level backups dir
        if (p.endsWith('backups')) {
          return [
            { name: '2026-05-15T10-00-00-000Z', isDirectory: () => true } as any,
            { name: '2026-05-17T12-00-00-000Z', isDirectory: () => true } as any,
            { name: '2026-05-16T08-30-00-000Z', isDirectory: () => true } as any,
            { name: 'not-a-backup.txt', isDirectory: () => false } as any,
          ];
        }
        // Sub-directory calls for getDirSize
        return [];
      });

      // statSync is called for getDirSize and mtime
      let statCallCount = 0;
      mockStatSync.mockImplementation(() => {
        statCallCount++;
        return {
          size: 100,
          mtime: new Date('2026-05-17T12:00:00.000Z'),
          isDirectory: () => false,
        } as any;
      });

      const backups = listBackups();

      expect(backups).toHaveLength(3);
      // 降序排列
      expect(backups[0].id).toBe('2026-05-17T12-00-00-000Z');
      expect(backups[1].id).toBe('2026-05-16T08-30-00-000Z');
      expect(backups[2].id).toBe('2026-05-15T10-00-00-000Z');
    });

    it('无备份时返回空数组', () => {
      mockExistsSync.mockReturnValue(true);
      mockReaddirSync.mockReturnValue([]);

      expect(listBackups()).toEqual([]);
    });

    it('忽略非目录文件', () => {
      mockExistsSync.mockReturnValue(true);
      mockReaddirSync.mockReturnValue([
        { name: 'readme.txt', isDirectory: () => false } as any,
        { name: 'backup.db', isDirectory: () => false } as any,
      ]);

      expect(listBackups()).toEqual([]);
    });
  });

  describe('deleteBackup', () => {
    it('删除有效的备份目录', () => {
      mockExistsSync.mockReturnValue(true);

      const result = deleteBackup('2026-05-17T12-00-00-000Z');

      expect(result).toBe(true);
      expect(mockRmSync).toHaveBeenCalled();
    });

    it('ID 格式无效时返回 false', () => {
      expect(deleteBackup('invalid-id')).toBe(false);
      expect(deleteBackup('')).toBe(false);
      expect(deleteBackup('../../../etc')).toBe(false);
    });

    it('路径遍历攻击时返回 false', () => {
      expect(deleteBackup('2026-05-17../../../etc')).toBe(false);
    });

    it('备份目录不存在时返回 false', () => {
      mockExistsSync.mockReturnValue(false);

      const result = deleteBackup('2026-05-17T12-00-00-000Z');

      expect(result).toBe(false);
    });
  });

  describe('cleanupOldBackups', () => {
    it('删除超出保留数量的旧备份', () => {
      mockExistsSync.mockReturnValue(true);
      mockReaddirSync.mockImplementation((dirPath: unknown) => {
        const p = String(dirPath);
        if (p.endsWith('backups') && !p.includes('2026')) {
          return [
            { name: '2026-05-17', isDirectory: () => true } as any,
            { name: '2026-05-16', isDirectory: () => true } as any,
            { name: '2026-05-15', isDirectory: () => true } as any,
            { name: '2026-05-14', isDirectory: () => true } as any,
          ];
        }
        return [];
      });
      mockStatSync.mockImplementation(() => ({
        mtime: new Date('2026-05-17T12:00:00.000Z'),
        size: 100,
        isDirectory: () => false,
      }) as any);

      const count = cleanupOldBackups(2);

      expect(count).toBe(2);
    });

    it('备份数量不超过保留数量时返回 0', () => {
      mockExistsSync.mockReturnValue(true);
      mockReaddirSync.mockImplementation((p: unknown) => {
        if (String(p).endsWith('backups') && !String(p).includes('2026')) {
          return [
            { name: '2026-05-17', isDirectory: () => true } as any,
          ];
        }
        return [];
      });
      mockStatSync.mockImplementation(() => ({
        mtime: new Date('2026-05-17T12:00:00.000Z'),
        size: 100,
        isDirectory: () => false,
      }) as any);

      const count = cleanupOldBackups(5);

      expect(count).toBe(0);
    });

    it('保留数量为 0 时删除全部', () => {
      mockExistsSync.mockReturnValue(true);
      mockReaddirSync.mockImplementation((dirPath: unknown) => {
        const p = String(dirPath);
        if (p.endsWith('backups') && !p.includes('2026')) {
          return [
            { name: '2026-05-17', isDirectory: () => true } as any,
            { name: '2026-05-16', isDirectory: () => true } as any,
          ];
        }
        return [];
      });
      mockStatSync.mockImplementation(() => ({
        mtime: new Date('2026-05-17T12:00:00.000Z'),
        size: 100,
        isDirectory: () => false,
      }) as any);

      const count = cleanupOldBackups(0);

      expect(count).toBe(2);
    });
  });

  describe('getBackupConfig', () => {
    it('配置文件不存在时返回默认配置', () => {
      mockExistsSync.mockReturnValue(false);

      const config = getBackupConfig();

      expect(config).toEqual({
        enabled: true,
        intervalHours: 6,
        keepCount: 7,
      });
    });

    it('从文件读取自定义配置', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(
        JSON.stringify({
          enabled: false,
          intervalHours: 12,
          keepCount: 3,
        }),
      );

      const config = getBackupConfig();

      expect(config.enabled).toBe(false);
      expect(config.intervalHours).toBe(12);
      expect(config.keepCount).toBe(3);
    });

    it('配置文件解析失败时返回默认配置', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('invalid json');

      const config = getBackupConfig();

      expect(config).toEqual({
        enabled: true,
        intervalHours: 6,
        keepCount: 7,
      });
    });

    it('部分字段缺失时用默认值填充', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(
        JSON.stringify({ enabled: false }),
      );

      const config = getBackupConfig();

      expect(config.enabled).toBe(false);
      expect(config.intervalHours).toBe(6);
      expect(config.keepCount).toBe(7);
    });
  });

  describe('setBackupConfig', () => {
    it('部分更新配置', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(
        JSON.stringify({
          enabled: true,
          intervalHours: 6,
          keepCount: 7,
        }),
      );

      const updated = setBackupConfig({ intervalHours: 24 });

      expect(updated.intervalHours).toBe(24);
      expect(updated.enabled).toBe(true);
      expect(updated.keepCount).toBe(7);
      expect(mockWriteFileSync).toHaveBeenCalled();
    });

    it('更新全部字段', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(
        JSON.stringify({
          enabled: true,
          intervalHours: 6,
          keepCount: 7,
        }),
      );

      const updated = setBackupConfig({
        enabled: false,
        intervalHours: 12,
        keepCount: 3,
      });

      expect(updated.enabled).toBe(false);
      expect(updated.intervalHours).toBe(12);
      expect(updated.keepCount).toBe(3);
    });

    it('配置文件不存在时从默认值开始合并', () => {
      mockExistsSync.mockReturnValue(false);

      const updated = setBackupConfig({ keepCount: 5 });

      expect(updated.keepCount).toBe(5);
      expect(updated.enabled).toBe(true);
      expect(updated.intervalHours).toBe(6);
    });

    it('写入 JSON 格式', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(
        JSON.stringify({ enabled: true, intervalHours: 6, keepCount: 7 }),
      );

      setBackupConfig({ enabled: false });

      expect(mockWriteFileSync).toHaveBeenCalled();
      const writeCall = mockWriteFileSync.mock.calls[0];
      const writtenData = JSON.parse(writeCall[1] as string);
      expect(writtenData.enabled).toBe(false);
    });
  });
});
