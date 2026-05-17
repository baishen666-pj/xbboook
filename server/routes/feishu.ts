import { Router } from 'express';
import { getDb } from '../db/database.js';
import crypto from 'node:crypto';
import { validateFeishuApp, getTenantToken, syncChapterToFeishu } from '../services/feishuSync.js';

const router = Router({ mergeParams: true });

function rowToConfig(row: any) {
  return {
    id: row.id,
    projectId: row.project_id,
    appId: row.app_id,
    appSecret: '••••••••',
    docToken: row.doc_token,
    syncMode: row.sync_mode,
    lastSyncAt: row.last_sync_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Get Feishu config
router.get('/', (req, res) => {
  const db = getDb();
  const row = db.prepare('SELECT * FROM feishu_sync WHERE project_id = ?').get(req.params.projectId);
  res.json({ success: true, data: row ? rowToConfig(row) : null });
});

// Validate app credentials
router.post('/validate', async (req, res) => {
  const { appId, appSecret } = req.body;
  if (!appId || !appSecret) { res.status(400).json({ success: false, error: 'appId and appSecret required' }); return; }
  const valid = await validateFeishuApp(appId, appSecret);
  res.json({ success: true, data: { valid } });
});

// Save config
router.post('/', (req, res) => {
  const { appId, appSecret, docToken, syncMode } = req.body;
  if (!appId || !appSecret || !docToken) {
    res.status(400).json({ success: false, error: 'appId, appSecret, and docToken required' });
    return;
  }

  const db = getDb();
  const projectId = req.params.projectId;
  const existing = db.prepare('SELECT * FROM feishu_sync WHERE project_id = ?').get(projectId);

  if (existing) {
    db.prepare(`UPDATE feishu_sync SET app_id = ?, app_secret = ?, doc_token = ?, sync_mode = ?, updated_at = datetime('now')
      WHERE project_id = ?`).run(appId, appSecret, docToken, syncMode || 'all', projectId);
  } else {
    const id = crypto.randomUUID();
    db.prepare(`INSERT INTO feishu_sync (id, project_id, app_id, app_secret, doc_token, sync_mode)
      VALUES (?, ?, ?, ?, ?, ?)`).run(id, projectId, appId, appSecret, docToken, syncMode || 'all');
  }

  const row = db.prepare('SELECT * FROM feishu_sync WHERE project_id = ?').get(projectId);
  res.json({ success: true, data: rowToConfig(row) });
});

// Sync now
router.post('/sync', async (req, res) => {
  const db = getDb();
  const config = db.prepare('SELECT * FROM feishu_sync WHERE project_id = ?').get(req.params.projectId);
  if (!config) { res.status(404).json({ success: false, error: 'Feishu not configured' }); return; }

  const token = await getTenantToken(config.app_id, config.app_secret);
  const chapters = db.prepare(
    'SELECT id, title FROM chapters WHERE project_id = ? ORDER BY sort_order',
  ).all(req.params.projectId);

  const results: Array<{ chapterId: string; status: string }> = [];
  let errors = 0;

  for (const ch of chapters.slice(0, 50)) {
    try {
      const fileService = await import('../services/fileService.js');
      const content = await fileService.readChapter(req.params.projectId, (ch as any).id);
      await syncChapterToFeishu(token, config.doc_token, {
        id: (ch as any).id,
        title: (ch as any).title,
        content: content || '',
      });
      results.push({ chapterId: (ch as any).id, status: 'synced' });
    } catch (err) {
      errors++;
      results.push({ chapterId: (ch as any).id, status: `error: ${err instanceof Error ? err.message : 'unknown'}` });
    }
  }

  db.prepare("UPDATE feishu_sync SET last_sync_at = datetime('now'), updated_at = datetime('now') WHERE project_id = ?")
    .run(req.params.projectId);

  res.json({ success: true, data: { synced: results.length - errors, errors, details: results } });
});

// Delete config
router.delete('/', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM feishu_sync WHERE project_id = ?').run(req.params.projectId);
  res.json({ success: true, data: { deleted: true } });
});

export default router;
