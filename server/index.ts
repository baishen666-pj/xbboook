import fs from 'fs';
import path from 'path';
import http from 'http';
import app from './app.js';
import { runMigrations } from './db/migrations.js';
import { seedBuiltins } from './db/repositories/templateRepo.js';
import { seedBuiltinSnippets } from './db/seedSnippets.js';
import { createWsServer } from './ws/wsServer.js';
import {
  getBackupConfig,
  createBackup,
  cleanupOldBackups,
} from './services/backupService.js';
import { logger } from './middleware/logger.js';

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
seedBuiltinSnippets();

const server = http.createServer(app);
createWsServer(server);

server.listen(PORT, () => {
  logger.info(`Server running at http://localhost:${PORT}`);
  logger.info(`API available at http://localhost:${PORT}/api`);
  logger.info(`WebSocket available at ws://localhost:${PORT}/ws`);

  // Start auto-backup scheduler
  const backupConfig = getBackupConfig();
  let backupIntervalRef: ReturnType<typeof setInterval> | null = null;

  function runAutoBackup() {
    try {
      createBackup();
      cleanupOldBackups(backupConfig.keepCount);
      logger.info('Auto-backup completed');
    } catch (err) {
      logger.error({ err }, 'Auto-backup failed');
    }
  }

  function startBackupScheduler() {
    if (backupIntervalRef) {
      clearInterval(backupIntervalRef);
    }
    if (backupConfig.enabled) {
      const intervalMs = backupConfig.intervalHours * 60 * 60 * 1000;
      backupIntervalRef = setInterval(runAutoBackup, intervalMs);
      logger.info(`Auto-backup enabled: every ${backupConfig.intervalHours}h, keeping ${backupConfig.keepCount} backups`);
    }
  }

  startBackupScheduler();

  process.on('SIGTERM', () => {
    if (backupIntervalRef) {
      clearInterval(backupIntervalRef);
    }
  });
});
