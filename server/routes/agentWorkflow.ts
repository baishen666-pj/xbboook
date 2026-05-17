import { Router } from 'express';
import * as workflowRepo from '../db/repositories/agentWorkflowRepo.js';
import { BUILTIN_WORKFLOWS } from '../db/repositories/agentWorkflowRepo.js';
import { runWorkflow } from '../ai/agentWorkflowEngine.js';
import { readChapter } from '../services/fileService.js';
import { setupSSE, sendSSE, sendSSEDone, sendSSEError } from '../middleware/sse.js';

const router = Router();

// List workflows
router.get('/', (_req, res) => {
  const workflows = workflowRepo.findAll();
  res.json({ success: true, data: workflows });
});

// Get single workflow
router.get('/:id', (req, res) => {
  const wf = workflowRepo.findById(req.params.id);
  if (!wf) {
    res.status(404).json({ success: false, error: '工作流不存在' });
    return;
  }
  res.json({ success: true, data: wf });
});

// Create workflow
router.post('/', (req, res) => {
  const { name, description, steps } = req.body as { name?: string; description?: string; steps?: unknown[] };

  if (!name || !steps || !Array.isArray(steps)) {
    res.status(400).json({ success: false, error: 'name 和 steps 必填' });
    return;
  }

  const wf = workflowRepo.create({ name, description, steps: steps as workflowRepo.WorkflowStep[] });
  res.json({ success: true, data: wf });
});

// Initialize built-in workflows
router.post('/init-builtin', (_req, res) => {
  const existing = workflowRepo.findAll().filter(w => w.is_builtin);
  if (existing.length > 0) {
    res.json({ success: true, data: existing });
    return;
  }

  const created = BUILTIN_WORKFLOWS.map(w => workflowRepo.create(w));
  res.json({ success: true, data: created });
});

// Execute workflow (SSE)
router.post('/:id/execute', async (req, res) => {
  const { projectId, chapterId } = req.body as { projectId?: string; chapterId?: string };

  if (!projectId || !chapterId) {
    res.status(400).json({ success: false, error: 'projectId 和 chapterId 必填' });
    return;
  }

  const wf = workflowRepo.findById(req.params.id);
  if (!wf) {
    res.status(404).json({ success: false, error: '工作流不存在' });
    return;
  }

  const steps = JSON.parse(wf.steps) as workflowRepo.WorkflowStep[];

  let existingContent = '';
  try {
    existingContent = await readChapter(projectId, chapterId);
  } catch { /* empty chapter */ }

  setupSSE(res);

  try {
    for await (const event of runWorkflow(projectId, chapterId, steps, existingContent)) {
      sendSSE(res, event.type, event);
    }
    sendSSEDone(res);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    sendSSEError(res, message);
  }
});

// Update workflow
router.patch('/:id', (req, res) => {
  const wf = workflowRepo.findById(req.params.id);
  if (!wf) {
    res.status(404).json({ success: false, error: '工作流不存在' });
    return;
  }
  if (wf.is_builtin) {
    res.status(400).json({ success: false, error: '内置工作流不可修改' });
    return;
  }

  const { name, description, steps } = req.body as { name?: string; description?: string; steps?: unknown[] };
  workflowRepo.update(req.params.id, {
    name,
    description,
    steps: steps ? JSON.stringify(steps) : undefined,
  });

  res.json({ success: true, data: workflowRepo.findById(req.params.id) });
});

// Delete workflow
router.delete('/:id', (req, res) => {
  workflowRepo.deleteById(req.params.id);
  res.json({ success: true });
});

export default router;
