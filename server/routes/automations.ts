import { Router } from 'express';
import { getDb } from '../db/database.js';
import crypto from 'node:crypto';
import { getTriggerTypes, getActionTypes, matchesTrigger, executeAction } from '../services/automationEngine.js';

const router = Router({ mergeParams: true });

function rowToRule(row: any) {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    enabled: !!row.enabled,
    trigger: JSON.parse(row.trigger_config),
    action: JSON.parse(row.action_config),
    lastTriggeredAt: row.last_triggered_at,
    runCount: row.run_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// List rules
router.get('/', (req, res) => {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM automation_rules WHERE project_id = ? ORDER BY created_at DESC')
    .all(req.params.projectId);
  res.json({ success: true, data: rows.map(rowToRule) });
});

// Get trigger/action types
router.get('/types', (_req, res) => {
  res.json({ success: true, data: { triggers: getTriggerTypes(), actions: getActionTypes() } });
});

// Create rule
router.post('/', (req, res) => {
  const { name, trigger, action, enabled } = req.body;
  if (!name || !trigger?.type || !action?.type) {
    res.status(400).json({ success: false, error: 'name, trigger.type, and action.type required' });
    return;
  }

  const id = crypto.randomUUID();
  const db = getDb();
  db.prepare(`INSERT INTO automation_rules (id, project_id, name, enabled, trigger_config, action_config)
    VALUES (?, ?, ?, ?, ?, ?)`).run(
    id, req.params.projectId, name, enabled !== false ? 1 : 0,
    JSON.stringify(trigger), JSON.stringify(action),
  );

  const row = db.prepare('SELECT * FROM automation_rules WHERE id = ?').get(id);
  res.status(201).json({ success: true, data: rowToRule(row) });
});

// Update rule
router.put('/:ruleId', (req, res) => {
  const { ruleId, projectId } = req.params;
  const { name, trigger, action, enabled } = req.body;
  const db = getDb();

  const existing = db.prepare('SELECT * FROM automation_rules WHERE id = ? AND project_id = ?').get(ruleId, projectId);
  if (!existing) { res.status(404).json({ success: false, error: 'Not found' }); return; }

  db.prepare(`UPDATE automation_rules SET name = ?, trigger_config = ?, action_config = ?, enabled = ?, updated_at = datetime('now')
    WHERE id = ?`).run(
    name ?? existing.name,
    trigger ? JSON.stringify(trigger) : existing.trigger_config,
    action ? JSON.stringify(action) : existing.action_config,
    enabled !== undefined ? (enabled ? 1 : 0) : existing.enabled,
    ruleId,
  );

  const row = db.prepare('SELECT * FROM automation_rules WHERE id = ?').get(ruleId);
  res.json({ success: true, data: rowToRule(row) });
});

// Delete rule
router.delete('/:ruleId', (req, res) => {
  const db = getDb();
  const result = db.prepare('DELETE FROM automation_rules WHERE id = ? AND project_id = ?')
    .run(req.params.ruleId, req.params.projectId);
  res.json({ success: true, data: { deleted: result.changes > 0 } });
});

// Test rule
router.post('/:ruleId/test', async (req, res) => {
  const db = getDb();
  const row = db.prepare('SELECT * FROM automation_rules WHERE id = ? AND project_id = ?')
    .get(req.params.ruleId, req.params.projectId);
  if (!row) { res.status(404).json({ success: false, error: 'Not found' }); return; }

  const rule = rowToRule(row);
  const start = Date.now();
  const result = await executeAction(rule.action, { test: true, projectId: req.params.projectId });

  const execId = crypto.randomUUID();
  db.prepare(`INSERT INTO automation_executions (id, rule_id, trigger_event, action_type, success, error, duration_ms)
    VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    execId, rule.id, 'test', rule.action.type, result.success ? 1 : 0, result.error || null, Date.now() - start,
  );

  res.json({ success: true, data: result });
});

// Execution history
router.get('/:ruleId/executions', (req, res) => {
  const db = getDb();
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const rows = db.prepare(
    'SELECT * FROM automation_executions WHERE rule_id = ? ORDER BY created_at DESC LIMIT ?',
  ).all(req.params.ruleId, limit);

  res.json({ success: true, data: rows.map((r: any) => ({
    id: r.id, ruleId: r.rule_id, triggerEvent: r.trigger_event,
    actionType: r.action_type, success: !!r.success, error: r.error,
    durationMs: r.duration_ms, createdAt: r.created_at,
  })) });
});

export default router;
