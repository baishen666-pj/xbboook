import { Router } from 'express';
import * as wvRepo from '../db/repositories/worldviewRepo.js';

const router = Router({ mergeParams: true });

// List worldviews (optionally filter by category)
router.get('/', (req, res) => {
  const { projectId } = req.params as { projectId: string };
  const { category } = req.query as { category?: string };

  if (category) {
    const items = wvRepo.findByCategory(projectId, category);
    res.json({ success: true, data: items });
  } else {
    const items = wvRepo.findByProject(projectId);
    const categories = wvRepo.getCategories(projectId);
    res.json({ success: true, data: { items, categories } });
  }
});

// Get categories
router.get('/categories', (req, res) => {
  const { projectId } = req.params as { projectId: string };
  const categories = wvRepo.getCategories(projectId);
  res.json({ success: true, data: categories });
});

// Get single worldview
router.get('/:id', (req, res) => {
  const item = wvRepo.findById(req.params.id);
  if (!item) {
    res.status(404).json({ success: false, error: 'Worldview not found' });
    return;
  }
  res.json({ success: true, data: item });
});

// Create worldview
router.post('/', (req, res) => {
  const { projectId } = req.params as { projectId: string };
  const { category, title, content } = req.body;

  if (!category || !title) {
    res.status(400).json({ success: false, error: 'category and title are required' });
    return;
  }

  const item = wvRepo.create({ projectId, category, title, content });
  res.status(201).json({ success: true, data: item });
});

// Update worldview
router.put('/:id', (req, res) => {
  const item = wvRepo.update(req.params.id, req.body);
  if (!item) {
    res.status(404).json({ success: false, error: 'Worldview not found' });
    return;
  }
  res.json({ success: true, data: item });
});

// Delete worldview
router.delete('/:id', (req, res) => {
  const deleted = wvRepo.deleteById(req.params.id);
  if (!deleted) {
    res.status(404).json({ success: false, error: 'Worldview not found' });
    return;
  }
  res.json({ success: true, data: null });
});

export default router;
