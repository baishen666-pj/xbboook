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
import { errorHandler } from './middleware/errorHandler.js';

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { success: false, error: 'Too many AI requests, please try again later' },
});

app.use('/api/projects', projectsRouter);
app.use('/api/projects/:projectId/volumes', volumesRouter);
app.use('/api/projects/:projectId/chapters', chaptersRouter);
app.use('/api/projects/:projectId/chapters/:chapterId/versions', versionsRouter);
app.use('/api/projects/:projectId/characters', charactersRouter);
app.use('/api/projects/:projectId/worldviews', worldviewsRouter);
app.use('/api/projects/:projectId/outlines', outlinesRouter);
app.use('/api/projects/:projectId/stats', statsRouter);
app.use('/api/projects/:projectId/export', exportRouter);
app.use('/api/ai', aiLimiter, aiRouter);
app.use('/api/templates', templatesRouter);
app.use('/api/users', usersRouter);
app.use('/api/projects/:projectId/collab', collabRouter);
app.use('/api/projects/:projectId/chapters/:chapterId/comments', commentsRouter);
app.use('/api/backups', backupRouter);

app.use(errorHandler);

// Serve static frontend (production)
const distPath = path.join(process.cwd(), 'dist');
app.use(express.static(distPath));
app.get('*', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

export default app;
