import { Router } from 'express';
import {
  createBackup,
  listBackups,
  deleteBackup,
  cleanupOldBackups,
  getBackupConfig,
  setBackupConfig,
} from '../services/backupService.js';

const router = Router();

router.get('/config', (_req, res) => {
  try {
    const config = getBackupConfig();
    res.json({ success: true, data: config });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : '获取备份配置失败',
    });
  }
});

router.patch('/config', (req, res) => {
  try {
    const updated = setBackupConfig(req.body);
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : '更新备份配置失败',
    });
  }
});

router.get('/', (_req, res) => {
  try {
    const backups = listBackups();
    res.json({ success: true, data: backups });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : '获取备份列表失败',
    });
  }
});

router.post('/', (_req, res) => {
  try {
    const config = getBackupConfig();
    const backup = createBackup();
    if (config.keepCount > 0) {
      cleanupOldBackups(config.keepCount);
    }
    res.status(201).json({ success: true, data: backup });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : '创建备份失败',
    });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const deleted = deleteBackup(req.params.id);
    if (!deleted) {
      res.status(404).json({ success: false, error: '备份不存在' });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : '删除备份失败',
    });
  }
});

export default router;
