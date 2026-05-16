import { Router } from 'express';
import { processAiRequest, listSkills, getSkill, isConfigured } from '../services/aiService.js';
import { setupSSE, sendSSE, sendSSEError, sendSSEDone } from '../middleware/sse.js';
import { getConfig } from '../ai/agentFactory.js';
import { saveConfig, loadStoredConfig } from '../ai/configStore.js';
import { PROVIDERS } from '../ai/providers.js';
import { findById as findChapterById } from '../db/repositories/chapterRepo.js';
import { findById as findProjectById } from '../db/repositories/projectRepo.js';
import { findByProject as findCharacters } from '../db/repositories/characterRepo.js';
import { findByProject as findOutlines } from '../db/repositories/outlineRepo.js';
import { findByProject as findWorldviews } from '../db/repositories/worldviewRepo.js';
import { findAll as findAllForeshadowing } from '../db/repositories/foreshadowingRepo.js';
import { readChapter } from '../services/fileService.js';
import { createJob, runPipeline, getJob } from '../ai/chapterPipeline.js';
import { getPluginSkill, getPluginSkills } from '../plugins/registry.js';

const router = Router();

function validateBaseUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return 'baseUrl 仅支持 http/https 协议';
    }
    if (parsed.hostname === '169.254.169.254' || parsed.hostname === 'metadata.google.internal') {
      return '不允许访问云元数据端点';
    }
    return null;
  } catch {
    return 'baseUrl 格式无效';
  }
}

function sanitizeApiKey(text: string): string {
  return text
    .replace(/sk-[a-zA-Z0-9]{20,}/g, '***')
    .replace(/key-[a-zA-Z0-9]{20,}/g, '***')
    .replace(/dify-[a-zA-Z0-9]{20,}/g, '***')
    .replace(/(?:Bearer\s*)?[a-f0-9]{32,}/gi, '***')
    .replace(/(?:Bearer\s*)?[A-Za-z0-9+_/-]{40,}/g, (m) => m.startsWith('Bearer ') ? m : '***');
}

// List available providers
router.get('/providers', (_req, res) => {
  res.json({ success: true, data: PROVIDERS });
});

// List available skills
router.get('/skills', (_req, res) => {
  const builtIn = listSkills();
  const plugins = getPluginSkills();
  res.json({ success: true, data: [...builtIn, ...plugins] });
});

// Get AI configuration status
router.get('/status', (_req, res) => {
  const config = getConfig();
  const maskedKey = config.apiKey
    ? config.apiKey.slice(0, 4) + '***' + config.apiKey.slice(-4)
    : '';
  res.json({
    success: true,
    data: {
      configured: isConfigured(),
      provider: config.provider,
      model: config.model,
      baseUrl: config.baseUrl,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      apiKeyHint: maskedKey,
    },
  });
});

// Update AI configuration (full: provider, apiKey, baseUrl, model, temperature, maxTokens)
router.patch('/config', (req, res) => {
  const { provider, apiKey, baseUrl, model, temperature, maxTokens } = req.body;

  if (temperature !== undefined && (typeof temperature !== 'number' || temperature < 0 || temperature > 2)) {
    res.status(400).json({ success: false, error: 'temperature must be between 0 and 2' });
    return;
  }
  if (maxTokens !== undefined && (typeof maxTokens !== 'number' || maxTokens < 1 || maxTokens > 128000)) {
    res.status(400).json({ success: false, error: 'maxTokens must be between 1 and 128000' });
    return;
  }
  if (model !== undefined && typeof model !== 'string') {
    res.status(400).json({ success: false, error: 'model must be a string' });
    return;
  }
  if (provider !== undefined && typeof provider !== 'string') {
    res.status(400).json({ success: false, error: 'provider must be a string' });
    return;
  }
  if (apiKey !== undefined && typeof apiKey !== 'string') {
    res.status(400).json({ success: false, error: 'apiKey must be a string' });
    return;
  }
  if (baseUrl !== undefined) {
    if (typeof baseUrl !== 'string') {
      res.status(400).json({ success: false, error: 'baseUrl must be a string' });
      return;
    }
    const err = validateBaseUrl(baseUrl);
    if (err) {
      res.status(400).json({ success: false, error: err });
      return;
    }
  }

  const updated = saveConfig({ provider, apiKey, baseUrl, model, temperature, maxTokens });
  const maskedKey = updated.apiKey
    ? updated.apiKey.slice(0, 4) + '***' + updated.apiKey.slice(-4)
    : '';

  res.json({
    success: true,
    data: {
      provider: updated.provider,
      model: updated.model,
      baseUrl: updated.baseUrl,
      temperature: updated.temperature,
      maxTokens: updated.maxTokens,
      apiKeyHint: maskedKey,
    },
  });
});

// Test connection to LLM provider
router.post('/test', async (_req, res) => {
  const config = loadStoredConfig();

  if (!config.apiKey) {
    res.json({ success: false, error: '请先配置 API Key' });
    return;
  }

  try {
    const url = `${config.baseUrl.replace(/\/$/, '')}/chat/completions`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: 'user', content: '你好' }],
        max_tokens: 10,
        stream: false,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (response.ok) {
      const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
      const reply = data.choices?.[0]?.message?.content || '(empty)';
      res.json({ success: true, data: { reply: reply.slice(0, 100) } });
    } else {
      const errorText = await response.text();
      const sanitized = sanitizeApiKey(errorText);
      res.json({ success: false, error: `HTTP ${response.status}: ${sanitized.slice(0, 200)}` });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message.includes('abort')) {
      res.json({ success: false, error: '连接超时（15秒）' });
    } else {
      res.json({ success: false, error: `连接失败: ${message}` });
    }
  }
});

// SSE streaming AI request
router.post('/stream', async (req, res) => {
  const { projectId, skillId, chapterId, selectedText, targetStyle, question, customInstruction, outlineContent, historyMessages, character1Id, character2Id } = req.body;

  if (!projectId || !skillId) {
    res.status(400).json({ success: false, error: 'projectId and skillId are required' });
    return;
  }

  const skill = getSkill(skillId) || getPluginSkill(skillId);
  if (!skill) {
    res.status(400).json({ success: false, error: `Unknown skill: ${skillId}` });
    return;
  }

  if (skill.needsSelection && !selectedText) {
    res.status(400).json({ success: false, error: `Skill "${skill.name}" requires selected text` });
    return;
  }

  if (skillId === 'character-dialogue' && (!character1Id || !character2Id)) {
    res.status(400).json({ success: false, error: '角色对话模拟需要选择两个角色' });
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
      outlineContent,
      historyMessages,
      character1Id,
      character2Id,
    })) {
      if (event.type === 'chunk') {
        fullContent += event.content;
        sendSSE(res, 'chunk', { content: event.content });
      } else if (event.type === 'done') {
        sendSSEDone(res, event.content || fullContent, event.tokenUsage);
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

// SSE batch polish endpoint
router.post('/batch-polish', async (req, res) => {
  const { projectId, chapterIds } = req.body as { projectId?: string; chapterIds?: string[] };

  if (!projectId || !Array.isArray(chapterIds) || chapterIds.length === 0) {
    res.status(400).json({ success: false, error: 'projectId and chapterIds are required' });
    return;
  }

  if (chapterIds.length > 10) {
    res.status(400).json({ success: false, error: '单次批量润色最多 10 个章节' });
    return;
  }

  const skill = getSkill('polish');
  if (!skill) {
    res.status(500).json({ success: false, error: 'Polish skill not found' });
    return;
  }

  if (!isConfigured()) {
    res.status(400).json({ success: false, error: 'AI 未配置，请设置 AI_API_KEY 环境变量' });
    return;
  }

  setupSSE(req, res);

  const results: Array<{ chapterId: string; status: string; content?: string; error?: string }> = [];

  for (const chapterId of chapterIds) {
    const chapter = findChapterById(chapterId);
    if (!chapter) {
      sendSSE(res, 'chapter_progress', { chapterId, status: 'error', error: '章节未找到' });
      results.push({ chapterId, status: 'error', error: '章节未找到' });
      continue;
    }

    sendSSE(res, 'chapter_progress', { chapterId, status: 'processing' });

    try {
      const content = await readChapter(projectId, chapterId);
      if (!content.trim()) {
        sendSSE(res, 'chapter_progress', { chapterId, status: 'error', error: '章节内容为空' });
        results.push({ chapterId, status: 'error', error: '章节内容为空' });
        continue;
      }

      let fullContent = '';

      for await (const event of processAiRequest({
        projectId,
        skillId: 'polish',
        chapterId,
        selectedText: content,
      })) {
        if (event.type === 'chunk') {
          fullContent += event.content;
        }
      }

      sendSSE(res, 'chapter_progress', { chapterId, status: 'done', content: fullContent });
      results.push({ chapterId, status: 'done', content: fullContent });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      sendSSE(res, 'chapter_progress', { chapterId, status: 'error', error: message });
      results.push({ chapterId, status: 'error', error: message });
    }

    // Delay between chapters to respect rate limits
    if (chapterId !== chapterIds[chapterIds.length - 1]) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }

  sendSSE(res, 'all_done', { results });
  res.end();
});

// SSE batch chapter generation endpoint
router.post('/batch-generate', async (req, res) => {
  const { projectId, chapterIds } = req.body as { projectId?: string; chapterIds?: string[] };

  if (!projectId || !Array.isArray(chapterIds) || chapterIds.length === 0) {
    res.status(400).json({ success: false, error: 'projectId and chapterIds are required' });
    return;
  }

  if (chapterIds.length > 10) {
    res.status(400).json({ success: false, error: '单次批量生成最多 10 个章节' });
    return;
  }

  if (!isConfigured()) {
    res.status(400).json({ success: false, error: 'AI 未配置，请设置 AI_API_KEY 环境变量' });
    return;
  }

  setupSSE(req, res);

  const job = createJob(projectId, chapterIds);

  try {
    for await (const event of runPipeline(job)) {
      sendSSE(res, event.type, event);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    sendSSEError(res, message);
  }

  res.end();
});

// Get pipeline job status
router.get('/pipeline/:jobId', (req, res) => {
  const job = getJob(req.params.jobId);
  if (!job) {
    res.status(404).json({ success: false, error: '任务不存在' });
    return;
  }
  res.json({ success: true, data: job });
});

// Lightweight inline completion
router.post('/complete', async (req, res) => {
  const { projectId, chapterId, cursorContext, maxTokens } = req.body;
  if (!projectId || !chapterId || !cursorContext) {
    res.status(400).json({ success: false, error: 'projectId, chapterId, cursorContext required' });
    return;
  }
  if (!isConfigured()) {
    res.status(400).json({ success: false, error: 'AI 未配置' });
    return;
  }
  try {
    const { completeChat } = await import('../ai/agentFactory.js');
    const result = await completeChat(
      [
        { role: 'system', content: '你是一位网文写作助手。根据给定的光标前后文本，续写接下来的内容。只输出续写内容，不要解释。续写应自然衔接上下文，保持风格一致，50-200字。' },
        { role: 'user', content: cursorContext },
      ],
      { maxTokens: maxTokens || 200 },
    );
    res.json({ success: true, data: { completion: result } });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : '补全失败' });
  }
});

// Context summary for frontend hints
router.get('/context-summary/:projectId', (req, res) => {
  const { projectId } = req.params;
  try {
    const project = findProjectById(projectId);
    const foreshadowings = findAllForeshadowing(projectId);
    const characters = findCharacters(projectId);
    const outlines = findOutlines(projectId);
    const worldviews = findWorldviews(projectId);
    res.json({
      success: true,
      data: {
        genre: project?.genre || null,
        hasWorldview: worldviews.length > 0,
        plantedForeshadowingCount: foreshadowings.filter(f => f.status === 'planted').length,
        charactersWithoutVoice: characters.filter(c => !c.speech_style && !c.verbal_tics).length,
        outlineNodeCount: outlines.length,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : '获取上下文摘要失败' });
  }
});

export default router;
