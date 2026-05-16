import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import supertest from 'supertest';
import express from 'express';

let app: express.Application;

const mockGetBackupConfig = vi.fn();
const mockSetBackupConfig = vi.fn();
const mockCreateBackup = vi.fn();
const mockListBackups = vi.fn();
const mockDeleteBackup = vi.fn();
const mockCleanupOldBackups = vi.fn();

async function createTestApp() {
  vi.doMock('../../server/services/backupService.js', () => ({
    getBackupConfig: mockGetBackupConfig,
    setBackupConfig: mockSetBackupConfig,
    createBackup: mockCreateBackup,
    listBackups: mockListBackups,
    deleteBackup: mockDeleteBackup,
    cleanupOldBackups: mockCleanupOldBackups,
  }));

  const { default: backupRouter } = await import('../../server/routes/backup.js');
  const app = express();
  app.use(express.json());
  app.use('/api/backups', backupRouter);
  return app;
}

describe('Backup Routes', () => {
  beforeEach(() => {
    vi.resetModules();
    mockGetBackupConfig.mockReset();
    mockSetBackupConfig.mockReset();
    mockCreateBackup.mockReset();
    mockListBackups.mockReset();
    mockDeleteBackup.mockReset();
    mockCleanupOldBackups.mockReset();
  });

  afterEach(() => {
    vi.doUnmock('../../server/services/backupService.js');
  });

  describe('GET /api/backups/config', () => {
    it('returns the current backup config', async () => {
      mockGetBackupConfig.mockReturnValue({
        enabled: true,
        intervalHours: 6,
        keepCount: 7,
      });

      app = await createTestApp();
      const res = await supertest(app).get('/api/backups/config');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual({
        enabled: true,
        intervalHours: 6,
        keepCount: 7,
      });
      expect(mockGetBackupConfig).toHaveBeenCalledOnce();
    });

    it('returns 500 when getBackupConfig throws', async () => {
      mockGetBackupConfig.mockImplementation(() => {
        throw new Error('Config file corrupted');
      });

      app = await createTestApp();
      const res = await supertest(app).get('/api/backups/config');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Config file corrupted');
    });

    it('returns generic error message for non-Error throws', async () => {
      mockGetBackupConfig.mockImplementation(() => {
        throw 'unknown failure';
      });

      app = await createTestApp();
      const res = await supertest(app).get('/api/backups/config');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('获取备份配置失败');
    });
  });

  describe('PATCH /api/backups/config', () => {
    it('updates enabled field', async () => {
      mockSetBackupConfig.mockReturnValue({
        enabled: false,
        intervalHours: 6,
        keepCount: 7,
      });

      app = await createTestApp();
      const res = await supertest(app)
        .patch('/api/backups/config')
        .send({ enabled: false });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.enabled).toBe(false);
      expect(mockSetBackupConfig).toHaveBeenCalledWith({ enabled: false });
    });

    it('updates intervalHours field', async () => {
      mockSetBackupConfig.mockReturnValue({
        enabled: true,
        intervalHours: 12,
        keepCount: 7,
      });

      app = await createTestApp();
      const res = await supertest(app)
        .patch('/api/backups/config')
        .send({ intervalHours: 12 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.intervalHours).toBe(12);
      expect(mockSetBackupConfig).toHaveBeenCalledWith({ intervalHours: 12 });
    });

    it('updates keepCount field', async () => {
      mockSetBackupConfig.mockReturnValue({
        enabled: true,
        intervalHours: 6,
        keepCount: 3,
      });

      app = await createTestApp();
      const res = await supertest(app)
        .patch('/api/backups/config')
        .send({ keepCount: 3 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.keepCount).toBe(3);
      expect(mockSetBackupConfig).toHaveBeenCalledWith({ keepCount: 3 });
    });

    it('updates multiple fields at once', async () => {
      mockSetBackupConfig.mockReturnValue({
        enabled: false,
        intervalHours: 24,
        keepCount: 2,
      });

      app = await createTestApp();
      const res = await supertest(app)
        .patch('/api/backups/config')
        .send({ enabled: false, intervalHours: 24, keepCount: 2 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual({
        enabled: false,
        intervalHours: 24,
        keepCount: 2,
      });
      expect(mockSetBackupConfig).toHaveBeenCalledWith({
        enabled: false,
        intervalHours: 24,
        keepCount: 2,
      });
    });

    it('rejects intervalHours below minimum (0)', async () => {
      app = await createTestApp();
      const res = await supertest(app)
        .patch('/api/backups/config')
        .send({ intervalHours: 0 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('rejects keepCount below minimum (0)', async () => {
      app = await createTestApp();
      const res = await supertest(app)
        .patch('/api/backups/config')
        .send({ keepCount: 0 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('rejects negative intervalHours', async () => {
      app = await createTestApp();
      const res = await supertest(app)
        .patch('/api/backups/config')
        .send({ intervalHours: -1 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('rejects negative keepCount', async () => {
      app = await createTestApp();
      const res = await supertest(app)
        .patch('/api/backups/config')
        .send({ keepCount: -5 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('rejects unknown fields due to strict schema', async () => {
      app = await createTestApp();
      const res = await supertest(app)
        .patch('/api/backups/config')
        .send({ enabled: true, unknownField: 'value' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('rejects wrong type for enabled', async () => {
      app = await createTestApp();
      const res = await supertest(app)
        .patch('/api/backups/config')
        .send({ enabled: 'yes' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('rejects wrong type for intervalHours', async () => {
      app = await createTestApp();
      const res = await supertest(app)
        .patch('/api/backups/config')
        .send({ intervalHours: 'daily' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('accepts empty body and passes it to setBackupConfig', async () => {
      mockSetBackupConfig.mockReturnValue({
        enabled: true,
        intervalHours: 6,
        keepCount: 7,
      });

      app = await createTestApp();
      const res = await supertest(app)
        .patch('/api/backups/config')
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockSetBackupConfig).toHaveBeenCalledWith({});
    });

    it('returns 500 when setBackupConfig throws', async () => {
      mockSetBackupConfig.mockImplementation(() => {
        throw new Error('Write failed');
      });

      app = await createTestApp();
      const res = await supertest(app)
        .patch('/api/backups/config')
        .send({ enabled: true });

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Write failed');
    });

    it('returns generic error for non-Error throws in PATCH config', async () => {
      mockSetBackupConfig.mockImplementation(() => {
        throw 'disk full';
      });

      app = await createTestApp();
      const res = await supertest(app)
        .patch('/api/backups/config')
        .send({ enabled: true });

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('更新备份配置失败');
    });
  });

  describe('GET /api/backups', () => {
    it('returns an empty list when no backups exist', async () => {
      mockListBackups.mockReturnValue([]);

      app = await createTestApp();
      const res = await supertest(app).get('/api/backups');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual([]);
      expect(mockListBackups).toHaveBeenCalledOnce();
    });

    it('returns a list of backups', async () => {
      const backups = [
        { id: '2026-05-16T10-00-00', createdAt: '2026-05-16T10:00:00.000Z', sizeBytes: 1024 },
        { id: '2026-05-15T08-30-00', createdAt: '2026-05-15T08:30:00.000Z', sizeBytes: 2048 },
      ];
      mockListBackups.mockReturnValue(backups);

      app = await createTestApp();
      const res = await supertest(app).get('/api/backups');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(backups);
    });

    it('returns 500 when listBackups throws', async () => {
      mockListBackups.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      app = await createTestApp();
      const res = await supertest(app).get('/api/backups');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Permission denied');
    });

    it('returns generic error for non-Error throws in list', async () => {
      mockListBackups.mockImplementation(() => {
        throw null;
      });

      app = await createTestApp();
      const res = await supertest(app).get('/api/backups');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('获取备份列表失败');
    });
  });

  describe('POST /api/backups', () => {
    it('creates a backup and returns 201', async () => {
      const backupInfo = {
        id: '2026-05-16T12-00-00',
        createdAt: '2026-05-16T12:00:00.000Z',
        sizeBytes: 4096,
      };
      mockGetBackupConfig.mockReturnValue({ enabled: true, intervalHours: 6, keepCount: 7 });
      mockCreateBackup.mockReturnValue(backupInfo);
      mockCleanupOldBackups.mockReturnValue(0);

      app = await createTestApp();
      const res = await supertest(app).post('/api/backups');

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(backupInfo);
      expect(mockCreateBackup).toHaveBeenCalledOnce();
    });

    it('calls cleanupOldBackups when keepCount > 0', async () => {
      mockGetBackupConfig.mockReturnValue({ enabled: true, intervalHours: 6, keepCount: 3 });
      mockCreateBackup.mockReturnValue({
        id: '2026-05-16T12-00-00',
        createdAt: '2026-05-16T12:00:00.000Z',
        sizeBytes: 4096,
      });
      mockCleanupOldBackups.mockReturnValue(2);

      app = await createTestApp();
      const res = await supertest(app).post('/api/backups');

      expect(res.status).toBe(201);
      expect(mockCleanupOldBackups).toHaveBeenCalledWith(3);
    });

    it('skips cleanup when keepCount is 0', async () => {
      mockGetBackupConfig.mockReturnValue({ enabled: true, intervalHours: 6, keepCount: 0 });
      mockCreateBackup.mockReturnValue({
        id: '2026-05-16T12-00-00',
        createdAt: '2026-05-16T12:00:00.000Z',
        sizeBytes: 4096,
      });

      app = await createTestApp();
      const res = await supertest(app).post('/api/backups');

      expect(res.status).toBe(201);
      expect(mockCleanupOldBackups).not.toHaveBeenCalled();
    });

    it('returns 500 when createBackup throws', async () => {
      mockGetBackupConfig.mockReturnValue({ enabled: true, intervalHours: 6, keepCount: 7 });
      mockCreateBackup.mockImplementation(() => {
        throw new Error('Disk full');
      });

      app = await createTestApp();
      const res = await supertest(app).post('/api/backups');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Disk full');
    });

    it('returns generic error for non-Error throws in create', async () => {
      mockGetBackupConfig.mockReturnValue({ enabled: true, intervalHours: 6, keepCount: 7 });
      mockCreateBackup.mockImplementation(() => {
        throw 42;
      });

      app = await createTestApp();
      const res = await supertest(app).post('/api/backups');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('创建备份失败');
    });

    it('returns 500 when getBackupConfig throws during create', async () => {
      mockGetBackupConfig.mockImplementation(() => {
        throw new Error('Config read error');
      });

      app = await createTestApp();
      const res = await supertest(app).post('/api/backups');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Config read error');
    });
  });

  describe('DELETE /api/backups/:id', () => {
    it('deletes an existing backup and returns 200', async () => {
      mockDeleteBackup.mockReturnValue(true);

      app = await createTestApp();
      const res = await supertest(app).delete('/api/backups/2026-05-16T12-00-00');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockDeleteBackup).toHaveBeenCalledWith('2026-05-16T12-00-00');
    });

    it('returns 404 when backup does not exist', async () => {
      mockDeleteBackup.mockReturnValue(false);

      app = await createTestApp();
      const res = await supertest(app).delete('/api/backups/nonexistent-id');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('备份不存在');
    });

    it('returns 500 when deleteBackup throws', async () => {
      mockDeleteBackup.mockImplementation(() => {
        throw new Error('File locked');
      });

      app = await createTestApp();
      const res = await supertest(app).delete('/api/backups/2026-05-16T12-00-00');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('File locked');
    });

    it('returns generic error for non-Error throws in delete', async () => {
      mockDeleteBackup.mockImplementation(() => {
        throw undefined;
      });

      app = await createTestApp();
      const res = await supertest(app).delete('/api/backups/2026-05-16T12-00-00');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('删除备份失败');
    });

    it('passes the id parameter correctly to deleteBackup', async () => {
      mockDeleteBackup.mockReturnValue(true);

      app = await createTestApp();
      const backupId = '2026-01-01T00-00-00-000Z';
      await supertest(app).delete(`/api/backups/${backupId}`);

      expect(mockDeleteBackup).toHaveBeenCalledWith(backupId);
    });
  });
});
