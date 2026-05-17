import { Router } from 'express';
import { z } from 'zod';
import * as svc from '../services/projectTemplateService.js';

const router = Router();

const createSchema = z.object({
  name: z.string().min(1),
  genre: z.string().optional(),
  description: z.string().optional(),
  structure: z.string().min(1),
}).strict();

router.get('/', (req, res) => {
  try {
    const genre = req.query.genre as string | undefined;
    const templates = svc.listProjectTemplates(genre);
    res.json({ success: true, data: templates });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : '获取模板列表失败' });
  }
});

router.get('/:id', (req, res) => {
  try {
    const template = svc.getProjectTemplate(req.params.id);
    if (!template) {
      res.status(404).json({ success: false, error: '模板不存在' });
      return;
    }
    res.json({ success: true, data: template });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : '获取模板失败' });
  }
});

router.post('/', (req, res) => {
  try {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.issues.map((i) => i.message).join('; ') });
      return;
    }
    const template = svc.createUserTemplate(parsed.data);
    res.status(201).json({ success: true, data: template });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : '创建模板失败' });
  }
});

router.post('/:id/apply', (req, res) => {
  try {
    const project = svc.applyProjectTemplate(req.params.id);
    res.status(201).json({ success: true, data: project });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : '应用模板失败' });
  }
});

router.post('/from-project', (req, res) => {
  try {
    const { projectId, name, description } = req.body as { projectId?: string; name?: string; description?: string };
    if (!projectId || !name) {
      res.status(400).json({ success: false, error: 'projectId and name are required' });
      return;
    }
    const template = svc.createFromProject(projectId, name, description);
    res.status(201).json({ success: true, data: template });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : '从项目创建模板失败' });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const deleted = svc.deleteProjectTemplate(req.params.id);
    if (!deleted) {
      res.status(404).json({ success: false, error: '模板不存在或为内置模板' });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : '删除模板失败' });
  }
});

export default router;
