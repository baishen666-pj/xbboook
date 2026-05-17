import { Router, type Request } from 'express';
import { isConfigured } from '../services/aiService.js';
import * as styleLearner from '../ai/styleLearner.js';
import * as styleFingerprintRepo from '../db/repositories/styleFingerprintRepo.js';

type ProjectParams = { projectId: string };

const router = Router({ mergeParams: true });

// Get fingerprint
router.get('/', (req: Request<ProjectParams>, res) => {
  const fp = styleLearner.getFingerprint(req.params.projectId);
  if (!fp) {
    res.json({ success: true, data: null });
    return;
  }
  res.json({ success: true, data: fp });
});

// Extract fingerprint
router.post('/', async (req: Request<ProjectParams>, res) => {
  if (!isConfigured()) {
    res.status(400).json({ success: false, error: 'AI 未配置' });
    return;
  }

  const { chapterIds } = req.body as { chapterIds?: string[] };

  try {
    const fp = await styleLearner.extractFingerprint(req.params.projectId, chapterIds);
    res.json({ success: true, data: fp });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ success: false, error: message });
  }
});

// Delete fingerprint
router.delete('/', (req: Request<ProjectParams>, res) => {
  styleFingerprintRepo.deleteByProject(req.params.projectId);
  res.json({ success: true });
});

export default router;
