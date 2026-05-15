import { Router } from 'express';
import * as outlineRepo from '../db/repositories/outlineRepo.js';

const router = Router({ mergeParams: true });

router.get('/', (req, res) => {
  const { projectId } = req.params as { projectId: string };
  const outlines = outlineRepo.findByProject(projectId);
  res.json({ success: true, data: outlines });
});

router.get('/:id', (req, res) => {
  const outline = outlineRepo.findById(req.params.id);
  if (!outline) {
    res.status(404).json({ success: false, error: 'Outline not found' });
    return;
  }
  const children = outlineRepo.findChildren(outline.project_id, req.params.id);
  res.json({ success: true, data: { outline, children } });
});

router.post('/', (req, res) => {
  const { projectId } = req.params as { projectId: string };
  const { level, parentId, targetRefId, title, content } = req.body;

  if (!title) {
    res.status(400).json({ success: false, error: 'title is required' });
    return;
  }

  const outline = outlineRepo.create({
    projectId,
    level,
    parentId,
    targetRefId,
    title,
    content,
  });

  res.status(201).json({ success: true, data: outline });
});

router.put('/:id', (req, res) => {
  const outline = outlineRepo.update(req.params.id, req.body);
  if (!outline) {
    res.status(404).json({ success: false, error: 'Outline not found' });
    return;
  }
  res.json({ success: true, data: outline });
});

router.delete('/:id', (req, res) => {
  const deleted = outlineRepo.deleteById(req.params.id);
  if (!deleted) {
    res.status(404).json({ success: false, error: 'Outline not found' });
    return;
  }
  res.json({ success: true, data: null });
});

export default router;
