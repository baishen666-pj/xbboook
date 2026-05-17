import { Router, type Request } from 'express';
import { createJob, getJob, runJob, pauseJob, resumeJob } from '../services/orchestratorService.js';
import { isConfigured } from '../services/aiService.js';
import { setupSSE, sendSSE, sendSSEError } from '../middleware/sse.js';

type ProjectParams = { projectId: string };

const router = Router({ mergeParams: true });

// Create orchestrator job
router.post('/', (req: Request<ProjectParams>, res) => {
  const { projectId } = req.params;
  const { chapterIds } = req.body as { chapterIds?: string[] };

  if (!chapterIds || !Array.isArray(chapterIds) || chapterIds.length === 0) {
    res.status(400).json({ success: false, error: 'chapterIds 必填' });
    return;
  }

  if (chapterIds.length > 20) {
    res.status(400).json({ success: false, error: '最多 20 个章节' });
    return;
  }

  if (!isConfigured()) {
    res.status(400).json({ success: false, error: 'AI 未配置' });
    return;
  }

  const job = createJob(projectId, chapterIds);
  res.status(201).json({ success: true, data: job });
});

// Run job with SSE streaming
router.post('/:jobId/run', async (req: Request<ProjectParams & { jobId: string }>, res) => {
  const { jobId } = req.params;
  const job = getJob(jobId);

  if (!job) {
    res.status(404).json({ success: false, error: '任务不存在' });
    return;
  }

  setupSSE(req, res);

  try {
    for await (const event of runJob(jobId)) {
      sendSSE(res, event.type, event);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    sendSSEError(res, message);
  }

  res.end();
});

// Get job status
router.get('/:jobId', (req: Request<ProjectParams & { jobId: string }>, res) => {
  const job = getJob(req.params.jobId);
  if (!job) {
    res.status(404).json({ success: false, error: '任务不存在' });
    return;
  }
  res.json({ success: true, data: job });
});

// Pause job
router.post('/:jobId/pause', (req: Request<ProjectParams & { jobId: string }>, res) => {
  const ok = pauseJob(req.params.jobId);
  if (!ok) {
    res.status(400).json({ success: false, error: '无法暂停' });
    return;
  }
  res.json({ success: true, data: getJob(req.params.jobId) });
});

// Resume job
router.post('/:jobId/resume', (req: Request<ProjectParams & { jobId: string }>, res) => {
  const ok = resumeJob(req.params.jobId);
  if (!ok) {
    res.status(400).json({ success: false, error: '无法恢复' });
    return;
  }
  res.json({ success: true, data: getJob(req.params.jobId) });
});

export default router;
