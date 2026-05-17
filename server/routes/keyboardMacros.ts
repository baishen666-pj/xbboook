import { Router } from 'express';
import { z } from 'zod';
import * as repo from '../db/repositories/keyboardMacroRepo.js';
import { validate } from '../middleware/validate.js';

const router = Router({ mergeParams: true });

const macroSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  trigger: z.string().min(1),
  actions: z.array(z.object({
    type: z.enum(['insert', 'replace', 'command', 'format']),
    value: z.string(),
    selection: z.string().optional(),
  })).min(1),
  scope: z.enum(['global', 'project', 'chapter']).default('project'),
});

router.get('/', (req, res) => {
  const macros = repo.findAll(req.params.projectId);
  res.json({ success: true, data: macros });
});

router.post('/', validate(macroSchema), (req, res) => {
  const macro = repo.create({ id: crypto.randomUUID(), projectId: req.params.projectId, ...req.body });
  res.status(201).json({ success: true, data: macro });
});

router.patch('/:macroId', (req, res) => {
  const macro = repo.update(req.params.macroId, req.body);
  if (!macro) return res.status(404).json({ success: false, error: '宏不存在' });
  res.json({ success: true, data: macro });
});

router.delete('/:macroId', (req, res) => {
  if (!repo.remove(req.params.macroId)) return res.status(404).json({ success: false, error: '宏不存在' });
  res.json({ success: true });
});

export default router;
