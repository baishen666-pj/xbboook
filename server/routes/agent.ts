import { Router, type Request } from 'express';
import { isConfigured } from '../services/aiService.js';
import { setupSSE, sendSSE, sendSSEDone, sendSSEError } from '../middleware/sse.js';
import * as agentCore from '../ai/agentCore.js';
import * as agentSessionRepo from '../db/repositories/agentSessionRepo.js';

type ProjectParams = { projectId: string };
type SessionParams = { projectId: string; sessionId: string };

const router = Router({ mergeParams: true });

// Create agent session
router.post('/', (req: Request<ProjectParams>, res) => {
  const { projectId } = req.params;
  const { chapterId, config } = req.body as { chapterId?: string; config?: Record<string, unknown> };

  if (!chapterId) {
    res.status(400).json({ success: false, error: 'chapterId 必填' });
    return;
  }

  if (!isConfigured()) {
    res.status(400).json({ success: false, error: 'AI 未配置' });
    return;
  }

  const session = agentCore.createSession(projectId, chapterId, config);
  res.json({ success: true, data: session });
});

// Start agent session (SSE stream)
router.post('/:sessionId/start', async (req: Request<SessionParams>, res) => {
  const { sessionId } = req.params;

  const session = agentSessionRepo.findById(sessionId);
  if (!session) {
    res.status(404).json({ success: false, error: '会话不存在' });
    return;
  }

  if (session.status !== 'idle' && session.status !== 'paused') {
    res.status(400).json({ success: false, error: `会话状态 ${session.status} 不可启动` });
    return;
  }

  setupSSE(res);

  try {
    for await (const event of agentCore.runAgentSession(sessionId)) {
      sendSSE(res, event.type, event.data);
    }
    sendSSEDone(res);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    sendSSEError(res, message);
  }
});

// Pause agent session
router.post('/:sessionId/pause', (req: Request<SessionParams>, res) => {
  const { sessionId } = req.params;
  const ok = agentCore.pauseSession(sessionId);
  if (!ok) {
    res.status(400).json({ success: false, error: '无法暂停' });
    return;
  }
  res.json({ success: true });
});

// Resume agent session
router.post('/:sessionId/resume', (req: Request<SessionParams>, res) => {
  const { sessionId } = req.params;
  const ok = agentCore.resumeSession(sessionId);
  if (!ok) {
    res.status(400).json({ success: false, error: '无法恢复' });
    return;
  }
  res.json({ success: true });
});

// Get session status
router.get('/:sessionId', (req: Request<SessionParams>, res) => {
  const session = agentCore.getSession(req.params.sessionId);
  if (!session) {
    res.status(404).json({ success: false, error: '会话不存在' });
    return;
  }
  res.json({ success: true, data: session });
});

// Get session decisions
router.get('/:sessionId/decisions', (req: Request<SessionParams>, res) => {
  const decisions = agentCore.getDecisions(req.params.sessionId);
  res.json({ success: true, data: decisions });
});

// Delete/cancel session
router.delete('/:sessionId', (req: Request<SessionParams>, res) => {
  agentCore.cancelSession(req.params.sessionId);
  res.json({ success: true });
});

export default router;
