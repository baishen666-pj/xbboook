import { Router } from 'express';
import { z } from 'zod';
import { getDb } from '../db/database.js';
import { readChapter } from '../services/fileService.js';
import { validate } from '../middleware/validate.js';

const router = Router({ mergeParams: true });

const createTemplateSchema = z.object({
  name: z.string().min(1, 'name 必填').max(100, 'name 最多 100 字'),
  category: z.string().max(50).default('general'),
  content: z.string().min(1, 'content 必填').max(50000, 'content 最多 50000 字'),
  description: z.string().max(500).optional(),
});

const updateTemplateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  category: z.string().max(50).optional(),
  content: z.string().min(1).max(50000).optional(),
  description: z.string().max(500).optional(),
});

function generateId(): string {
  return `tpl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

router.get('/', (req, res) => {
  const { projectId } = req.params as { projectId: string };

  try {
    const db = getDb();
    const templates = db.prepare(
      'SELECT * FROM writing_templates WHERE project_id = ? ORDER BY sort_order, created_at DESC'
    ).all(projectId);

    res.json({ success: true, data: templates });
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取模板列表失败';
    res.status(500).json({ success: false, error: message });
  }
});

router.post('/', validate(createTemplateSchema), (req, res) => {
  const { projectId } = req.params as { projectId: string };
  const { name, category, content, description } = req.body;

  try {
    const db = getDb();
    const id = generateId();
    const now = new Date().toISOString();

    const maxOrder = db.prepare(
      'SELECT COALESCE(MAX(sort_order), 0) as max_order FROM writing_templates WHERE project_id = ?'
    ).get(projectId) as { max_order: number };

    db.prepare(`
      INSERT INTO writing_templates (id, project_id, name, category, description, content, sort_order, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, projectId, name, category, description || null, content, maxOrder.max_order + 1, now, now);

    const template = db.prepare('SELECT * FROM writing_templates WHERE id = ?').get(id);
    res.json({ success: true, data: template });
  } catch (err) {
    const message = err instanceof Error ? err.message : '创建模板失败';
    res.status(500).json({ success: false, error: message });
  }
});

router.put('/:templateId', validate(updateTemplateSchema), (req, res) => {
  const { projectId } = req.params as { projectId: string };
  const { templateId } = req.params;

  try {
    const db = getDb();

    const existing = db.prepare(
      'SELECT * FROM writing_templates WHERE id = ? AND project_id = ?'
    ).get(templateId, projectId);

    if (!existing) {
      return res.status(404).json({ success: false, error: '模板不存在' });
    }

    const updates: string[] = [];
    const values: unknown[] = [];

    if (req.body.name !== undefined) { updates.push('name = ?'); values.push(req.body.name); }
    if (req.body.category !== undefined) { updates.push('category = ?'); values.push(req.body.category); }
    if (req.body.content !== undefined) { updates.push('content = ?'); values.push(req.body.content); }
    if (req.body.description !== undefined) { updates.push('description = ?'); values.push(req.body.description); }

    if (updates.length === 0) {
      return res.json({ success: true, data: existing });
    }

    updates.push("updated_at = datetime('now')");
    values.push(templateId, projectId);

    db.prepare(`UPDATE writing_templates SET ${updates.join(', ')} WHERE id = ? AND project_id = ?`)
      .run(...values);

    const updated = db.prepare('SELECT * FROM writing_templates WHERE id = ?').get(templateId);
    res.json({ success: true, data: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : '更新模板失败';
    res.status(500).json({ success: false, error: message });
  }
});

router.delete('/:templateId', (req, res) => {
  const { projectId } = req.params as { projectId: string };
  const { templateId } = req.params;

  try {
    const db = getDb();

    const existing = db.prepare(
      'SELECT * FROM writing_templates WHERE id = ? AND project_id = ?'
    ).get(templateId, projectId);

    if (!existing) {
      return res.status(404).json({ success: false, error: '模板不存在' });
    }

    db.prepare('DELETE FROM writing_templates WHERE id = ? AND project_id = ?')
      .run(templateId, projectId);

    res.json({ success: true, data: null });
  } catch (err) {
    const message = err instanceof Error ? err.message : '删除模板失败';
    res.status(500).json({ success: false, error: message });
  }
});

router.post('/apply/:chapterId', async (req, res) => {
  const { projectId } = req.params as { projectId: string };
  const { chapterId } = req.params;
  const { templateId } = req.body as { templateId?: string };

  if (!templateId) {
    return res.status(400).json({ success: false, error: 'templateId 必填' });
  }

  try {
    const db = getDb();

    const template = db.prepare(
      'SELECT * FROM writing_templates WHERE id = ? AND project_id = ?'
    ).get(templateId, projectId) as { content: string } | undefined;

    if (!template) {
      return res.status(404).json({ success: false, error: '模板不存在' });
    }

    const chapter = db.prepare(
      'SELECT * FROM chapters WHERE id = ? AND project_id = ?'
    ).get(chapterId, projectId) as { id: string; title: string } | undefined;

    if (!chapter) {
      return res.status(404).json({ success: false, error: '章节不存在' });
    }

    let existingContent = '';
    try {
      existingContent = await readChapter(projectId, chapterId);
    } catch {
      // chapter file may not exist yet
    }

    const applied = template.content.replace(/\{\{content\}\}/g, existingContent);

    res.json({
      success: true,
      data: {
        chapterId,
        templateId,
        content: applied,
        originalContent: existingContent,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : '应用模板失败';
    res.status(500).json({ success: false, error: message });
  }
});

export default router;
