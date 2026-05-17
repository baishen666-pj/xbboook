import { Router } from 'express';
import { getDb } from '../db/database.js';
import fs from 'fs/promises';
import path from 'path';

const router = Router({ mergeParams: true });

// Create a manual backup snapshot of project data
router.post('/snapshot', async (req, res) => {
  const { projectId } = req.params;
  const db = getDb();

  try {
    const tables = ['projects', 'volumes', 'chapters', 'characters', 'character_relations',
      'worldviews', 'outlines', 'daily_stats', 'writing_sessions', 'scenes',
      'chapter_dependencies', 'plot_turning_points', 'character_timelines'];

    const snapshot: Record<string, any[]> = {};
    for (const table of tables) {
      try {
        const rows = db.prepare(`SELECT * FROM ${table} WHERE project_id = ?`).all(projectId);
        snapshot[table] = rows;
      } catch {
        // Table might not exist, skip
      }
    }

    const backupDir = path.join(process.cwd(), 'data', 'backups', projectId);
    await fs.mkdir(backupDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `snapshot-${timestamp}.json`;
    await fs.writeFile(path.join(backupDir, filename), JSON.stringify(snapshot, null, 2));

    // Cleanup: keep only last 20 snapshots
    const files = (await fs.readdir(backupDir)).filter((f) => f.startsWith('snapshot-')).sort();
    if (files.length > 20) {
      const toDelete = files.slice(0, files.length - 20);
      for (const f of toDelete) {
        await fs.unlink(path.join(backupDir, f));
      }
    }

    res.json({
      success: true,
      data: { filename, tables: Object.keys(snapshot), totalRows: Object.values(snapshot).reduce((sum, rows) => sum + rows.length, 0) },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : '创建快照失败';
    res.status(500).json({ success: false, error: message });
  }
});

// List snapshots
router.get('/snapshots', async (req, res) => {
  const { projectId } = req.params;
  const backupDir = path.join(process.cwd(), 'data', 'backups', projectId);

  try {
    await fs.access(backupDir);
  } catch {
    return res.json({ success: true, data: [] });
  }

  try {
    const files = (await fs.readdir(backupDir))
      .filter((f) => f.startsWith('snapshot-') && f.endsWith('.json'))
      .sort()
      .reverse();

    const snapshots = await Promise.all(
      files.slice(0, 50).map(async (f) => {
        const stat = await fs.stat(path.join(backupDir, f));
        return {
          filename: f,
          size: stat.size,
          createdAt: stat.mtime.toISOString(),
        };
      })
    );

    res.json({ success: true, data: snapshots });
  } catch (err) {
    res.status(500).json({ success: false, error: '获取快照列表失败' });
  }
});

// Restore from snapshot
router.post('/restore', async (req, res) => {
  const { projectId } = req.params;
  const { filename } = req.body as { filename: string };

  if (!filename) {
    return res.status(400).json({ success: false, error: 'filename 参数必填' });
  }

  // Validate filename to prevent path traversal
  if (!/^snapshot-[\d-T]+\.json$/.test(filename)) {
    return res.status(400).json({ success: false, error: '无效的文件名' });
  }

  const filePath = path.join(process.cwd(), 'data', 'backups', projectId, filename);

  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const snapshot = JSON.parse(content);

    const db = getDb();
    const tablesToRestore = ['character_timelines', 'plot_turning_points', 'chapter_dependencies',
      'scenes', 'outlines', 'worldviews', 'character_relations', 'characters',
      'daily_stats', 'writing_sessions', 'chapters', 'volumes'];

    for (const table of tablesToRestore) {
      if (!snapshot[table]) continue;
      try {
        db.prepare(`DELETE FROM ${table} WHERE project_id = ?`).run(projectId);
        for (const row of snapshot[table]) {
          const cols = Object.keys(row);
          const vals = Object.values(row);
          const placeholders = cols.map(() => '?').join(',');
          try {
            db.prepare(`INSERT OR IGNORE INTO ${table} (${cols.join(',')}) VALUES (${placeholders})`).run(...vals);
          } catch {}
        }
      } catch {}
    }

    res.json({ success: true, data: { restoredTables: tablesToRestore.length } });
  } catch (err) {
    const message = err instanceof Error ? err.message : '恢复快照失败';
    res.status(500).json({ success: false, error: message });
  }
});

export default router;
