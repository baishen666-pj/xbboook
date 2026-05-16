import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'novel-pen.db');
const PROJECTS_DIR = path.join(DATA_DIR, 'projects');
const BACKUPS_DIR = path.join(DATA_DIR, 'backups');
const CONFIG_FILE = path.join(DATA_DIR, 'backup-config.json');

export interface BackupInfo {
  id: string;
  createdAt: string;
  sizeBytes: number;
}

export interface BackupConfig {
  enabled: boolean;
  intervalHours: number;
  keepCount: number;
}

const DEFAULT_CONFIG: BackupConfig = {
  enabled: true,
  intervalHours: 6,
  keepCount: 7,
};

function ensureBackupsDir(): void {
  if (!fs.existsSync(BACKUPS_DIR)) {
    fs.mkdirSync(BACKUPS_DIR, { recursive: true });
  }
}

function readConfig(): BackupConfig {
  if (!fs.existsSync(CONFIG_FILE)) {
    return { ...DEFAULT_CONFIG };
  }
  try {
    const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

function writeConfig(config: BackupConfig): void {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
}

function getDirSize(dirPath: string): number {
  let total = 0;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      total += getDirSize(fullPath);
    } else {
      total += fs.statSync(fullPath).size;
    }
  }
  return total;
}

export function createBackup(): BackupInfo {
  ensureBackupsDir();

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(BACKUPS_DIR, timestamp);
  fs.mkdirSync(backupDir, { recursive: true });

  if (fs.existsSync(DB_FILE)) {
    fs.copyFileSync(DB_FILE, path.join(backupDir, 'novel-pen.db'));
  }

  if (fs.existsSync(PROJECTS_DIR)) {
    fs.cpSync(PROJECTS_DIR, path.join(backupDir, 'projects'), { recursive: true });
  }

  const sizeBytes = getDirSize(backupDir);

  return {
    id: timestamp,
    createdAt: timestamp.replace(/-/g, (m, offset) => {
      if (offset === 4 || offset === 7) return '-';
      if (offset === 10) return 'T';
      if (offset >= 11) return m;
      return m;
    }),
    sizeBytes,
  };
}

export function listBackups(): BackupInfo[] {
  ensureBackupsDir();

  const entries = fs.readdirSync(BACKUPS_DIR, { withFileTypes: true });
  const backups: BackupInfo[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const backupPath = path.join(BACKUPS_DIR, entry.name);
    const sizeBytes = getDirSize(backupPath);
    const stat = fs.statSync(backupPath);

    backups.push({
      id: entry.name,
      createdAt: stat.mtime.toISOString(),
      sizeBytes,
    });
  }

  backups.sort((a, b) => b.id.localeCompare(a.id));
  return backups;
}

export function deleteBackup(id: string): boolean {
  const backupDir = path.join(BACKUPS_DIR, id);
  if (!fs.existsSync(backupDir)) {
    return false;
  }
  fs.rmSync(backupDir, { recursive: true, force: true });
  return true;
}

export function cleanupOldBackups(keepCount: number): number {
  const backups = listBackups();
  if (backups.length <= keepCount) return 0;

  const toDelete = backups.slice(keepCount);
  for (const backup of toDelete) {
    deleteBackup(backup.id);
  }
  return toDelete.length;
}

export function getBackupConfig(): BackupConfig {
  return readConfig();
}

export function setBackupConfig(patch: Partial<BackupConfig>): BackupConfig {
  const current = readConfig();
  const updated: BackupConfig = {
    enabled: patch.enabled !== undefined ? patch.enabled : current.enabled,
    intervalHours: patch.intervalHours !== undefined ? patch.intervalHours : current.intervalHours,
    keepCount: patch.keepCount !== undefined ? patch.keepCount : current.keepCount,
  };
  writeConfig(updated);
  return updated;
}
