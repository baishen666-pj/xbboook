import { Router } from 'express';
import { getDb } from '../db/database.js';
import crypto from 'node:crypto';
import { getSupportedEvents, deliverWebhook, signPayload } from '../services/webhookService.js';

const router = Router();

function rowToConfig(row: any) {
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    secret: row.secret,
    events: JSON.parse(row.events),
    enabled: !!row.enabled,
    projectId: row.project_id || undefined,
    headers: JSON.parse(row.headers || '{}'),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// List webhooks
router.get('/', (req, res) => {
  const db = getDb();
  const projectId = req.query.projectId as string;
  const rows = projectId
    ? db.prepare('SELECT * FROM webhooks WHERE project_id = ? ORDER BY created_at DESC').all(projectId)
    : db.prepare('SELECT * FROM webhooks ORDER BY created_at DESC').all();
  res.json({ success: true, data: rows.map(rowToConfig) });
});

// Get supported events
router.get('/events', (_req, res) => {
  res.json({ success: true, data: getSupportedEvents() });
});

// Create webhook
router.post('/', (req, res) => {
  const { name, url, events, projectId, headers } = req.body;
  if (!name || !url || !events?.length) {
    res.status(400).json({ success: false, error: 'name, url, and events are required' });
    return;
  }

  const id = crypto.randomUUID();
  const secret = crypto.randomBytes(32).toString('hex');
  const db = getDb();
  db.prepare(`INSERT INTO webhooks (id, name, url, secret, events, enabled, project_id, headers)
    VALUES (?, ?, ?, ?, ?, 1, ?, ?)`).run(
    id, name, url, secret, JSON.stringify(events), projectId || null, JSON.stringify(headers || {}),
  );

  const row = db.prepare('SELECT * FROM webhooks WHERE id = ?').get(id);
  res.status(201).json({ success: true, data: rowToConfig(row) });
});

// Update webhook
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { name, url, events, enabled, headers } = req.body;
  const db = getDb();

  const existing = db.prepare('SELECT * FROM webhooks WHERE id = ?').get(id);
  if (!existing) { res.status(404).json({ success: false, error: 'Not found' }); return; }

  db.prepare(`UPDATE webhooks SET name = ?, url = ?, events = ?, enabled = ?, headers = ?, updated_at = datetime('now')
    WHERE id = ?`).run(
    name ?? existing.name,
    url ?? existing.url,
    events ? JSON.stringify(events) : existing.events,
    enabled !== undefined ? (enabled ? 1 : 0) : existing.enabled,
    headers ? JSON.stringify(headers) : existing.headers,
    id,
  );

  const row = db.prepare('SELECT * FROM webhooks WHERE id = ?').get(id);
  res.json({ success: true, data: rowToConfig(row) });
});

// Delete webhook
router.delete('/:id', (req, res) => {
  const db = getDb();
  const result = db.prepare('DELETE FROM webhooks WHERE id = ?').run(req.params.id);
  res.json({ success: true, data: { deleted: result.changes > 0 } });
});

// Test webhook
router.post('/:id/test', async (req, res) => {
  const db = getDb();
  const row = db.prepare('SELECT * FROM webhooks WHERE id = ?').get(req.params.id);
  if (!row) { res.status(404).json({ success: false, error: 'Not found' }); return; }

  const config = rowToConfig(row);
  const delivery = await deliverWebhook(config, {
    event: 'webhook:test',
    projectId: config.projectId || '',
    payload: { test: true, timestamp: new Date().toISOString() },
    timestamp: new Date().toISOString(),
  });

  db.prepare(`INSERT INTO webhook_deliveries (id, webhook_id, event, status_code, duration_ms, success, error)
    VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    delivery.id, delivery.webhookId, delivery.event,
    delivery.statusCode, delivery.duration, delivery.success ? 1 : 0, delivery.error || null,
  );

  res.json({ success: true, data: delivery });
});

// Delivery history
router.get('/:id/deliveries', (req, res) => {
  const db = getDb();
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const rows = db.prepare(
    'SELECT * FROM webhook_deliveries WHERE webhook_id = ? ORDER BY created_at DESC LIMIT ?',
  ).all(req.params.id, limit);

  res.json({ success: true, data: rows.map((r: any) => ({
    id: r.id, webhookId: r.webhook_id, event: r.event,
    statusCode: r.status_code, duration: r.duration_ms,
    success: !!r.success, error: r.error, createdAt: r.created_at,
  })) });
});

export default router;
