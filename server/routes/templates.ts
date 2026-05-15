import { Router } from 'express';
import { z } from 'zod';
import * as templateService from '../services/templateService.js';
import { validate } from '../middleware/validate.js';

const router = Router();

const createSchema = z.object({
  name: z.string().min(1, '模板名称不能为空'),
  genre: z.string().min(1, '请选择题材类型'),
  description: z.string().optional(),
  structure: z.string().refine((val) => {
    try { const arr = JSON.parse(val); return Array.isArray(arr); } catch { return false; }
  }, '模板结构格式无效'),
});

const applySchema = z.object({
  projectId: z.string().min(1),
  mode: z.enum(['replace', 'append']).default('append'),
});

const saveFromProjectSchema = z.object({
  name: z.string().min(1, '模板名称不能为空'),
  genre: z.string().min(1, '请选择题材类型'),
  description: z.string().optional(),
});

router.get('/', (req, res) => {
  const genre = req.query.genre as string | undefined;
  const templates = templateService.listTemplates(genre);
  res.json({ success: true, data: templates });
});

router.get('/:id', (req, res) => {
  const template = templateService.getTemplate(req.params.id);
  if (!template) {
    res.status(404).json({ success: false, error: '模板不存在' });
    return;
  }
  res.json({ success: true, data: template });
});

router.post('/', validate(createSchema), (req, res) => {
  const template = templateService.createUserTemplate(req.body);
  res.status(201).json({ success: true, data: template });
});

router.post('/:id/apply', validate(applySchema), (req, res) => {
  try {
    const outlines = templateService.applyTemplate(
      req.params.id,
      req.body.projectId,
      req.body.mode,
    );
    res.json({ success: true, data: outlines });
  } catch (err) {
    const message = err instanceof Error ? err.message : '应用模板失败';
    res.status(400).json({ success: false, error: message });
  }
});

router.post('/:id/save-from-project', validate(saveFromProjectSchema), (req, res) => {
  try {
    const template = templateService.createFromProject(
      req.params.id,
      req.body.name,
      req.body.genre,
      req.body.description,
    );
    res.status(201).json({ success: true, data: template });
  } catch (err) {
    const message = err instanceof Error ? err.message : '保存模板失败';
    res.status(400).json({ success: false, error: message });
  }
});

router.put('/:id', validate(createSchema), (req, res) => {
  try {
    const template = templateService.updateUserTemplate(req.params.id, req.body);
    res.json({ success: true, data: template });
  } catch (err) {
    const message = err instanceof Error ? err.message : '更新模板失败';
    res.status(400).json({ success: false, error: message });
  }
});

router.delete('/:id', (req, res) => {
  const deleted = templateService.deleteTemplate(req.params.id);
  if (!deleted) {
    res.status(400).json({ success: false, error: '删除失败（内置模板不可删除）' });
    return;
  }
  res.json({ success: true });
});

export default router;
