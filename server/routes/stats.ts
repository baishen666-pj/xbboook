import { Router } from 'express';
import * as statsRepo from '../db/repositories/statsRepo.js';

const router = Router({ mergeParams: true });

router.get('/', (req, res) => {
  const { projectId } = req.params as { projectId: string };
  const summary = statsRepo.getSummary(projectId);
  const recent = statsRepo.getRecent(projectId, 30);
  res.json({ success: true, data: { summary, recent } });
});

router.get('/recent', (req, res) => {
  const { projectId } = req.params as { projectId: string };
  const days = Number(req.query.days) || 30;
  const recent = statsRepo.getRecent(projectId, days);
  res.json({ success: true, data: recent });
});

router.post('/', (req, res) => {
  const { projectId } = req.params as { projectId: string };
  const { date, wordsAdded, wordsTotal, writingTimeMs, chaptersWorked } = req.body;

  if (!date || wordsAdded === undefined) {
    res.status(400).json({ success: false, error: 'date and wordsAdded are required' });
    return;
  }

  const stat = statsRepo.upsert({
    projectId,
    date,
    wordsAdded,
    wordsTotal: wordsTotal ?? 0,
    writingTimeMs: writingTimeMs ?? 0,
    chaptersWorked: chaptersWorked ?? 0,
  });

  res.json({ success: true, data: stat });
});

export default router;
