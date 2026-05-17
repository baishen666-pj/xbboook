import { Router } from 'express';
import * as insightsService from '../services/writingInsightsService.js';

const router = Router({ mergeParams: true });

router.get('/trends', (req, res) => {
  const { projectId } = req.params as { projectId: string };
  const period = req.query.period === 'month' ? 'month' : 'week';
  const data = insightsService.getWritingTrends(projectId, period);
  res.json({ success: true, data });
});

router.get('/ai-usage', (req, res) => {
  const { projectId } = req.params as { projectId: string };
  const period = req.query.period === 'month' ? 'month' : 'week';
  const data = insightsService.getAiUsageRate(projectId, period);
  res.json({ success: true, data });
});

router.get('/habits', (req, res) => {
  const { projectId } = req.params as { projectId: string };
  const data = insightsService.getWritingHabits(projectId);
  res.json({ success: true, data });
});

router.get('/productivity', (req, res) => {
  const { projectId } = req.params as { projectId: string };
  const data = insightsService.getProductivity(projectId);
  res.json({ success: true, data });
});

export default router;
