import { Router, type Request } from 'express';
import * as materialRepo from '../db/repositories/materialRepo.js';

type ProjectParams = { projectId: string };

const router = Router({ mergeParams: true });

const VALID_CATEGORIES = ['character', 'worldbuilding', 'plot', 'dialogue', 'setting', 'other'];

// List materials
router.get('/', (req: Request<ProjectParams>, res) => {
  const { projectId } = req.params;
  const category = req.query.category as string | undefined;
  const query = req.query.q as string | undefined;

  if (query) {
    const results = materialRepo.search(projectId, query);
    res.json({ success: true, data: results });
    return;
  }

  const materials = materialRepo.findByProject(projectId, category);
  res.json({ success: true, data: materials });
});

// Get category stats
router.get('/stats', (req: Request<ProjectParams>, res) => {
  const { projectId } = req.params;
  const stats = materialRepo.countByCategory(projectId);
  res.json({ success: true, data: stats });
});

// Create material
router.post('/', (req: Request<ProjectParams>, res) => {
  const { projectId } = req.params;
  const { title, content, category, tags, source, metadata } = req.body as {
    title?: string;
    content?: string;
    category?: string;
    tags?: string[];
    source?: string;
    metadata?: Record<string, unknown>;
  };

  if (!title || !content) {
    res.status(400).json({ success: false, error: 'title 和 content 必填' });
    return;
  }

  if (category && !VALID_CATEGORIES.includes(category)) {
    res.status(400).json({ success: false, error: `category 必须是: ${VALID_CATEGORIES.join(', ')}` });
    return;
  }

  const material = materialRepo.create({
    project_id: projectId,
    title,
    content,
    category: category || 'other',
    tags,
    source,
    metadata,
  });

  res.status(201).json({ success: true, data: material });
});

// Get single material
router.get('/:materialId', (req: Request<ProjectParams & { materialId: string }>, res) => {
  const material = materialRepo.findById(req.params.materialId);
  if (!material || material.project_id !== req.params.projectId) {
    res.status(404).json({ success: false, error: '素材不存在' });
    return;
  }
  res.json({ success: true, data: material });
});

// Update material
router.put('/:materialId', (req: Request<ProjectParams & { materialId: string }>, res) => {
  const { title, content, category, tags, source, metadata } = req.body as {
    title?: string;
    content?: string;
    category?: string;
    tags?: string[];
    source?: string;
    metadata?: Record<string, unknown>;
  };

  const existing = materialRepo.findById(req.params.materialId);
  if (!existing || existing.project_id !== req.params.projectId) {
    res.status(404).json({ success: false, error: '素材不存在' });
    return;
  }

  const updated = materialRepo.update(req.params.materialId, {
    title, content, category, tags, source, metadata,
  });

  res.json({ success: true, data: updated });
});

// Delete material
router.delete('/:materialId', (req: Request<ProjectParams & { materialId: string }>, res) => {
  const existing = materialRepo.findById(req.params.materialId);
  if (!existing || existing.project_id !== req.params.projectId) {
    res.status(404).json({ success: false, error: '素材不存在' });
    return;
  }

  materialRepo.remove(req.params.materialId);
  res.json({ success: true });
});

export default router;
