import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';

import projectsRouter from './routes/projects.js';
import chaptersRouter from './routes/chapters.js';
import volumesRouter from './routes/volumes.js';
import charactersRouter from './routes/characters.js';
import worldviewsRouter from './routes/worldviews.js';
import outlinesRouter from './routes/outlines.js';
import aiRouter from './routes/ai.js';
import statsRouter from './routes/stats.js';
import exportRouter from './routes/export.js';
import versionsRouter from './routes/versions.js';
import templatesRouter from './routes/templates.js';
import usersRouter from './routes/users.js';
import collabRouter from './routes/collab.js';
import commentsRouter from './routes/comments.js';
import backupRouter from './routes/backup.js';
import importRouter from './routes/import.js';
import foreshadowingRouter from './routes/foreshadowing.js';
import snippetsRouter from './routes/snippets.js';
import storyArcsRouter from './routes/storyArcs.js';
import searchRouter from './routes/search.js';
import healthRouter from './routes/health.js';
import checkInRouter from './routes/checkIn.js';
import achievementsRouter from './routes/achievements.js';
import pluginsRouter from './routes/plugins.js';
import projectTemplatesRouter from './routes/projectTemplates.js';
import { consistencyRouter } from './routes/consistency.js';
import memoryRouter from './routes/memory.js';
import publishRouter from './routes/publish.js';
import analysisRouter from './routes/analysis.js';
import materialsRouter from './routes/materials.js';
import orchestratorRouter from './routes/orchestrator.js';
import agentRouter from './routes/agent.js';
import storyPlannerRouter from './routes/storyPlanner.js';
import styleFingerprintRouter from './routes/styleFingerprint.js';
import promptTemplatesRouter from './routes/promptTemplates.js';
import agentWorkflowRouter from './routes/agentWorkflow.js';
import batchGenerationRouter from './routes/batchGeneration.js';
import webhooksRouter from './routes/webhooks.js';
import notionRouter from './routes/notion.js';
import feishuRouter from './routes/feishu.js';
import automationsRouter from './routes/automations.js';
import goalsRouter from './routes/goals.js';
import insightsRouter from './routes/insights.js';
import scenesRouter from './routes/scenes.js';
import qualityRouter from './routes/quality.js';
import chapterDepsRouter from './routes/chapterDependencies.js';
import outlineEnhanceRouter from './routes/outlineEnhance.js';
import characterDialogueRouter from './routes/characterDialogue.js';
import chapterOperationsRouter from './routes/chapterOperations.js';
import aiPolishRouter from './routes/aiPolish.js';
import turningPointsRouter from './routes/turningPoints.js';
import consistencyCheckRouter from './routes/consistencyCheck.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requestIdMiddleware, requestLogger } from './middleware/logger.js';

const app = express();

const isDev = process.env.NODE_ENV === 'development';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:'],
      fontSrc: ["'self'"],
      connectSrc: ["'self'", 'ws:', isDev ? 'http://localhost:*' : "'self'"],
      mediaSrc: ["'none'"],
      objectSrc: ["'none'"],
      frameSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'same-site' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));
app.use(cors({
  origin: process.env.CORS_ORIGIN || (isDev ? 'http://localhost:5210' : false),
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { success: false, error: 'Too many requests, please try again later' },
});

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { success: false, error: 'Too many AI requests, please try again later' },
});

app.use(requestIdMiddleware);
app.use(requestLogger);

app.use('/api', apiLimiter);

app.use('/api/health', healthRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/projects/:projectId/volumes', volumesRouter);
app.use('/api/projects/:projectId/chapters', chaptersRouter);
app.use('/api/projects/:projectId/chapters/:chapterId/versions', versionsRouter);
app.use('/api/projects/:projectId/characters', charactersRouter);
app.use('/api/projects/:projectId/worldviews', worldviewsRouter);
app.use('/api/projects/:projectId/outlines', outlinesRouter);
app.use('/api/projects/:projectId/stats', statsRouter);
app.use('/api/projects/:projectId/export', exportRouter);
app.use('/api/projects/:projectId/search', searchRouter);
app.use('/api/ai', aiLimiter, aiRouter);
app.use('/api/templates', templatesRouter);
app.use('/api/users', usersRouter);
app.use('/api/projects/:projectId/collab', collabRouter);
app.use('/api/projects/:projectId/chapters/:chapterId/comments', commentsRouter);
app.use('/api/backups', backupRouter);
app.use('/api/projects', importRouter);
app.use('/api/foreshadowing/:projectId', foreshadowingRouter);
app.use('/api/snippets/:projectId', snippetsRouter);
app.use('/api/projects/:projectId/story', storyArcsRouter);
app.use('/api/projects/:projectId/checkins', checkInRouter);
app.use('/api/projects/:projectId/achievements', achievementsRouter);
app.use('/api/plugins', pluginsRouter);
app.use('/api/project-templates', projectTemplatesRouter);
app.use('/api/consistency/:projectId', consistencyRouter);
app.use('/api/projects/:projectId/memory', memoryRouter);
app.use('/api/projects/:projectId/publish', publishRouter);
app.use('/api/projects/:projectId/analysis', analysisRouter);
app.use('/api/projects/:projectId/materials', materialsRouter);
app.use('/api/projects/:projectId/orchestrator', orchestratorRouter);
app.use('/api/projects/:projectId/agent', aiLimiter, agentRouter);
app.use('/api/projects/:projectId/story-planner', storyPlannerRouter);
app.use('/api/projects/:projectId/style-fingerprint', styleFingerprintRouter);
app.use('/api/prompt-templates', promptTemplatesRouter);
app.use('/api/agent-workflows', agentWorkflowRouter);
app.use('/api/projects/:projectId/batch-generation', aiLimiter, batchGenerationRouter);
app.use('/api/webhooks', webhooksRouter);
app.use('/api/projects/:projectId/notion', notionRouter);
app.use('/api/projects/:projectId/feishu', feishuRouter);
app.use('/api/projects/:projectId/automations', automationsRouter);
app.use('/api/projects/:projectId/goals', goalsRouter);
app.use('/api/projects/:projectId/insights', insightsRouter);
app.use('/api/projects/:projectId/scenes', scenesRouter);
app.use('/api/projects/:projectId/quality', qualityRouter);
app.use('/api/projects/:projectId/dependencies', chapterDepsRouter);
app.use('/api/projects/:projectId/outline-enhance', aiLimiter, outlineEnhanceRouter);
app.use('/api/projects/:projectId/character-dialogue', aiLimiter, characterDialogueRouter);
app.use('/api/projects/:projectId/chapter-ops', chapterOperationsRouter);
app.use('/api/projects/:projectId/ai-polish', aiLimiter, aiPolishRouter);
app.use('/api/projects/:projectId/turning-points', turningPointsRouter);
app.use('/api/projects/:projectId/consistency', aiLimiter, consistencyCheckRouter);

app.use(errorHandler);

// Serve static frontend (production)
const distPath = path.join(process.cwd(), 'dist');
app.use(express.static(distPath));
app.get('{*path}', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

export default app;
