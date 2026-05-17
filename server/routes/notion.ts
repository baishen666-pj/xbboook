import { Router } from 'express';
import { getDb } from '../db/database.js';
import crypto from 'node:crypto';
import { validateToken, listDatabases, syncChapterToNotion } from '../services/notionSync.js';

const router = Router({ mergeParams: true });

function rowToConfig(row: any) {
  return {
    id: row.id,
    projectId: row.project_id,
    notionToken: '••••••••',
    databaseId: row.database_id,
    syncMode: row.sync_mode,
    lastSyncAt: row.last_sync_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Get Notion config
router.get('/', (req, res) => {
  const db = getDb();
  const row = db.prepare('SELECT * FROM notion_sync WHERE project_id = ?').get(req.params.projectId);
  res.json({ success: true, data: row ? rowToConfig(row) : null });
});

// Validate token
router.post('/validate', async (req, res) => {
  const { token } = req.body;
  if (!token) { res.status(400).json({ success: false, error: 'Token required' }); return; }
  const valid = await validateToken(token);
  res.json({ success: true, data: { valid } });
});

// List databases
router.post('/databases', async (req, res) => {
  const { token } = req.body;
  if (!token) { res.status(400).json({ success: false, error: 'Token required' }); return; }
  const dbs = await listDatabases(token);
  res.json({ success: true, data: dbs });
});

// Save config
router.post('/', (req, res) => {
  const { notionToken, databaseId, syncMode } = req.body;
  if (!notionToken || !databaseId) {
    res.status(400).json({ success: false, error: 'notionToken and databaseId required' });
    return;
  }

  const db = getDb();
  const projectId = req.params.projectId;
  const existing = db.prepare('SELECT * FROM notion_sync WHERE project_id = ?').get(projectId);

  if (existing) {
    db.prepare(`UPDATE notion_sync SET notion_token = ?, database_id = ?, sync_mode = ?, updated_at = datetime('now')
      WHERE project_id = ?`).run(notionToken, databaseId, syncMode || 'all', projectId);
  } else {
    const id = crypto.randomUUID();
    db.prepare(`INSERT INTO notion_sync (id, project_id, notion_token, database_id, sync_mode)
      VALUES (?, ?, ?, ?, ?)`).run(id, projectId, notionToken, databaseId, syncMode || 'all');
  }

  const row = db.prepare('SELECT * FROM notion_sync WHERE project_id = ?').get(projectId);
  res.json({ success: true, data: rowToConfig(row) });
});

// Sync now
router.post('/sync', async (req, res) => {
  const db = getDb();
  const config = db.prepare('SELECT * FROM notion_sync WHERE project_id = ?').get(req.params.projectId);
  if (!config) { res.status(404).json({ success: false, error: 'Notion not configured' }); return; }

  const chapters = db.prepare(
    'SELECT id, title, word_count, status FROM chapters WHERE project_id = ? ORDER BY sort_order',
  ).all(req.params.projectId);

  const results: Array<{ chapterId: string; status: string }> = [];
  let errors = 0;

  for (const ch of chapters.slice(0, 50)) {
    try {
      const fileService = await import('../services/fileService.js');
      const content = await fileService.readChapter(req.params.projectId, (ch as any).id);
      await syncChapterToNotion(config.notion_token, config.database_id, {
        id: (ch as any).id,
        title: (ch as any).title,
        content: content || '',
        wordCount: (ch as any).word_count || 0,
        status: (ch as any).status || 'draft',
      });
      results.push({ chapterId: (ch as any).id, status: 'synced' });
    } catch (err) {
      errors++;
      results.push({ chapterId: (ch as any).id, status: `error: ${err instanceof Error ? err.message : 'unknown'}` });
    }
  }

  db.prepare("UPDATE notion_sync SET last_sync_at = datetime('now'), updated_at = datetime('now') WHERE project_id = ?")
    .run(req.params.projectId);

  res.json({ success: true, data: { synced: results.length - errors, errors, details: results } });
});

// Delete config
router.delete('/', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM notion_sync WHERE project_id = ?').run(req.params.projectId);
  res.json({ success: true, data: { deleted: true } });
});

export default router;
