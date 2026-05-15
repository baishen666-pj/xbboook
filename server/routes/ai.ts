import { Router } from 'express';
import { processAiRequest, listSkills, getSkill, isConfigured } from '../services/aiService.js';
import { setupSSE, sendSSE, sendSSEError, sendSSEDone } from '../middleware/sse.js';
import { getConfig, updateConfig, type AiConfig } from '../ai/agentFactory.js';

const router = Router();

// List available skills
router.get('/skills', (_req, res) => {
  res.json({ success: true, data: listSkills() });
});

// Get AI configuration status
router.get('/status', (_req, res) => {
  const config = getConfig();
  res.json({
    success: true,
    data: {
      configured: isConfigured(),
      model: config.model,
      baseUrl: config.baseUrl.replace(/\/v\d+$/, '').replace(/https?:\/\/[^/]+/, '***'),
    },
  });
});

// Update AI configuration
router.patch('/config', (req, res) => {
  const { model, temperature, maxTokens } = req.body;
  const updated = updateConfig({ model, temperature, maxTokens } as Partial<AiConfig>);
  res.json({
    success: true,
    data: {
      model: updated.model,
      temperature: updated.temperature,
      maxTokens: updated.maxTokens,
    },
  });
});

// SSE streaming AI request
router.post('/stream', async (req, res) => {
  const { projectId, skillId, chapterId, selectedText, targetStyle, question, customInstruction } = req.body;

  if (!projectId || !skillId) {
    res.status(400).json({ success: false, error: 'projectId and skillId are required' });
    return;
  }

  const skill = getSkill(skillId);
  if (!skill) {
    res.status(400).json({ success: false, error: `Unknown skill: ${skillId}` });
    return;
  }

  if (skill.needsSelection && !selectedText) {
    res.status(400).json({ success: false, error: `Skill "${skill.name}" requires selected text` });
    return;
  }

  setupSSE(req, res);

  try {
    let fullContent = '';

    for await (const event of processAiRequest({
      projectId,
      skillId,
      chapterId,
      selectedText,
      targetStyle,
      question,
      customInstruction,
    })) {
      if (event.type === 'chunk') {
        fullContent += event.content;
        sendSSE(res, 'chunk', { content: event.content });
      } else if (event.type === 'done') {
        sendSSEDone(res, event.content || fullContent);
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: message });
    } else {
      sendSSEError(res, message);
    }
  }
});

export default router;
