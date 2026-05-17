import { Router } from 'express';
import { setupSSE, sendSSE, sendSSEDone, sendSSEError } from '../middleware/sse.js';
import * as batchJobRepo from '../db/repositories/batchJobRepo.js';
import * as batchService from '../services/batchGeneration.js';

const router = Router({ mergeParams: true });

// POST /plan — generate batch plan from outlines
router.post('/plan', async (req, res) => {
  const { projectId } = req.params as { projectId: string };
  const { temperature } = req.body as { temperature?: number };

  try {
    const plan = await batchService.generateBatchPlan(projectId, { temperature });
    res.json({ success: true, data: plan });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ success: false, error: message });
  }
});

// POST /execute — SSE stream batch generation
router.post('/execute', async (req, res) => {
  const { projectId } = req.params as { projectId: string };
  const { plan, jobId: existingJobId } = req.body as {
    plan?: batchService.BatchPlan;
    jobId?: string;
  };

  if (!plan || !plan.chapters || !Array.isArray(plan.chapters)) {
    res.status(400).json({ success: false, error: 'plan.chapters 必填' });
    return;
  }

  let jobId = existingJobId;
  if (!jobId) {
    const job = batchJobRepo.create({
      projectId,
      planJson: JSON.stringify(plan),
      status: 'pending',
    });
    jobId = job.id;
  } else {
    const existing = batchJobRepo.findById(jobId);
    if (!existing || existing.project_id !== projectId) {
      res.status(404).json({ success: false, error: 'Job not found' });
      return;
    }
    batchService.resumeBatch(jobId);
  }

  setupSSE(res);

  try {
    for await (const event of batchService.runBatchGeneration(jobId, plan)) {
      sendSSE(res, event.type, event);
    }
    sendSSEDone(res, '');
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    sendSSEError(res, message);
  }
});

// POST /pause — pause running batch
router.post('/pause', (req, res) => {
  const { projectId } = req.params as { projectId: string };
  const { jobId } = req.body as { jobId?: string };

  if (!jobId) {
    res.status(400).json({ success: false, error: 'jobId 必填' });
    return;
  }

  const job = batchJobRepo.findById(jobId);
  if (!job || job.project_id !== projectId) {
    res.status(404).json({ success: false, error: 'Job not found' });
    return;
  }

  const updated = batchService.pauseBatch(jobId);
  if (!updated) {
    res.status(400).json({ success: false, error: 'Job is not running' });
    return;
  }

  res.json({ success: true, data: updated });
});

// POST /resume — resume paused batch via SSE
router.post('/resume', async (req, res) => {
  const { projectId } = req.params as { projectId: string };
  const { jobId } = req.body as { jobId?: string };

  if (!jobId) {
    res.status(400).json({ success: false, error: 'jobId 必填' });
    return;
  }

  const job = batchJobRepo.findById(jobId);
  if (!job || job.project_id !== projectId) {
    res.status(404).json({ success: false, error: 'Job not found' });
    return;
  }

  if (job.status !== 'paused') {
    res.status(400).json({ success: false, error: 'Job is not paused' });
    return;
  }

  const plan: batchService.BatchPlan = JSON.parse(job.plan_json);

  setupSSE(res);

  try {
    for await (const event of batchService.runBatchGeneration(jobId, plan)) {
      sendSSE(res, event.type, event);
    }
    sendSSEDone(res, '');
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    sendSSEError(res, message);
  }
});

// GET /status — get active batch for project
router.get('/status', (req, res) => {
  const { projectId } = req.params as { projectId: string };

  const activeJob = batchJobRepo.findActiveByProject(projectId);
  res.json({ success: true, data: activeJob || null });
});

// DELETE /:batchId — cancel batch job
router.delete('/:batchId', (req, res) => {
  const { projectId, batchId } = req.params as { projectId: string; batchId: string };

  const job = batchJobRepo.findById(batchId);
  if (!job || job.project_id !== projectId) {
    res.status(404).json({ success: false, error: 'Job not found' });
    return;
  }

  if (job.status === 'running' || job.status === 'pending') {
    batchJobRepo.updateStatus(batchId, 'cancelled');
  }

  batchJobRepo.deleteById(batchId);
  res.json({ success: true });
});

export default router;
