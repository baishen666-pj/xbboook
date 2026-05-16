import fs from 'fs';
import path from 'path';
import http from 'http';
import app from './app.js';
import { runMigrations } from './db/migrations.js';
import { seedBuiltins } from './db/repositories/templateRepo.js';
import { createWsServer } from './ws/wsServer.js';
import {
  getBackupConfig,
  createBackup,
  cleanupOldBackups,
} from './services/backupService.js';

const PORT = 3210;

const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const logsDir = path.join(process.cwd(), 'data', 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

runMigrations();
seedBuiltins();

const server = http.createServer(app);
createWsServer(server);

server.listen(PORT, () => {
  console.log(`[Xbboook] Server running at http://localhost:${PORT}`);
  console.log(`[Xbboook] API available at http://localhost:${PORT}/api`);
  console.log(`[Xbboook] WebSocket available at ws://localhost:${PORT}/ws`);

  // Start auto-backup scheduler
  const backupConfig = getBackupConfig();
  let backupIntervalRef: ReturnType<typeof setInterval> | null = null;

  function runAutoBackup() {
    try {
      createBackup();
      cleanupOldBackups(backupConfig.keepCount);
      console.log('[Xbboook] Auto-backup completed');
    } catch (err) {
      console.error('[Xbboook] Auto-backup failed:', err);
    }
  }

  function startBackupScheduler() {
    if (backupIntervalRef) {
      clearInterval(backupIntervalRef);
    }
    if (backupConfig.enabled) {
      const intervalMs = backupConfig.intervalHours * 60 * 60 * 1000;
      backupIntervalRef = setInterval(runAutoBackup, intervalMs);
      console.log(`[Xbboook] Auto-backup enabled: every ${backupConfig.intervalHours}h, keeping ${backupConfig.keepCount} backups`);
    }
  }

  startBackupScheduler();

  process.on('SIGTERM', () => {
    if (backupIntervalRef) {
      clearInterval(backupIntervalRef);
    }
  });
});
