import { Router } from 'express';
import { z } from 'zod';
import * as writingQualityService from '../services/writingQualityService.js';
import { validate } from '../middleware/validate.js';

const router = Router({ mergeParams: true });

const analyzeSchema = z.object({
  text: z.string().min(1).max(500000),
});

const compareSchema = z.object({
  textA: z.string().min(1),
  textB: z.string().min(1),
});

// Analyze text quality
router.post('/analyze', validate(analyzeSchema), (req, res) => {
  const report = writingQualityService.analyzeText(req.body.text);
  res.json({ success: true, data: report });
});

// Compare two versions
router.post('/compare', validate(compareSchema), (req, res) => {
  const reportA = writingQualityService.analyzeText(req.body.textA);
  const reportB = writingQualityService.analyzeText(req.body.textB);
  const comparison = writingQualityService.compareQuality(reportA, reportB);
  res.json({ success: true, data: { before: reportA, after: reportB, comparison } });
});

export default router;
