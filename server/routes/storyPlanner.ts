import { Router, type Request } from 'express';
import { isConfigured } from '../services/aiService.js';
import * as storyPlanner from '../services/storyPlanner.js';
import * as storyPlanRepo from '../db/repositories/storyPlanRepo.js';

type ProjectParams = { projectId: string };
type PlanParams = { projectId: string; planId: string };

const router = Router({ mergeParams: true });

// Generate plan
router.post('/', async (req: Request<ProjectParams>, res) => {
  const { projectId } = req.params;
  const { scope } = req.body as { scope?: string };

  if (!isConfigured()) {
    res.status(400).json({ success: false, error: 'AI 未配置' });
    return;
  }

  try {
    const plans = await storyPlanner.generateStoryPlan(
      projectId,
      (scope as 'full_novel' | 'next_volume' | 'next_arc') || 'full_novel',
    );
    res.json({ success: true, data: plans });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ success: false, error: message });
  }
});

// List plans
router.get('/', (req: Request<ProjectParams>, res) => {
  const plans = storyPlanner.getPlans(req.params.projectId);
  res.json({ success: true, data: plans });
});

// Get plan with children
router.get('/:planId', (req: Request<PlanParams>, res) => {
  const result = storyPlanner.getPlanWithChildren(req.params.planId);
  if (!result) {
    res.status(404).json({ success: false, error: '规划不存在' });
    return;
  }
  res.json({ success: true, data: result });
});

// Update plan
router.patch('/:planId', (req: Request<PlanParams>, res) => {
  const { planId } = req.params;
  const { title, description, status, targetData, sortOrder } = req.body as {
    title?: string;
    description?: string;
    status?: string;
    targetData?: Record<string, unknown>;
    sortOrder?: number;
  };

  if (status) {
    storyPlanRepo.updateStatus(planId, status as storyPlanRepo.StoryPlan['status']);
  }
  if (targetData) {
    storyPlanRepo.updateTarget(planId, targetData);
  }
  const fields: Record<string, unknown> = {};
  if (title !== undefined) fields.title = title;
  if (description !== undefined) fields.description = description;
  if (sortOrder !== undefined) fields.sort_order = sortOrder;
  if (Object.keys(fields).length > 0) {
    storyPlanRepo.updateFields(planId, fields);
  }

  const plan = storyPlanRepo.findById(planId);
  res.json({ success: true, data: plan });
});

// Delete plan
router.delete('/:planId', (req: Request<PlanParams>, res) => {
  storyPlanRepo.deleteById(req.params.planId);
  res.json({ success: true });
});

// Analyze pacing
router.post('/:planId/pacing', async (req: Request<PlanParams>, res) => {
  try {
    const snapshots = await storyPlanner.analyzePacing(req.params.projectId, req.params.planId);
    res.json({ success: true, data: snapshots });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ success: false, error: message });
  }
});

// Update progress
router.post('/:planId/progress', async (req: Request<PlanParams>, res) => {
  const { chapterId } = req.body as { chapterId: string };
  if (!chapterId) {
    res.status(400).json({ success: false, error: 'chapterId 必填' });
    return;
  }
  try {
    const snapshot = await storyPlanner.updatePlanProgress(req.params.projectId, chapterId);
    res.json({ success: true, data: snapshot });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ success: false, error: message });
  }
});

export default router;
