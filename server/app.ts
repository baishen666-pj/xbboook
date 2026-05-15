import express from 'express';
import cors from 'cors';

import projectsRouter from './routes/projects.js';
import chaptersRouter from './routes/chapters.js';
import volumesRouter from './routes/volumes.js';
import charactersRouter from './routes/characters.js';
import worldviewsRouter from './routes/worldviews.js';
import outlinesRouter from './routes/outlines.js';
import aiRouter from './routes/ai.js';
import statsRouter from './routes/stats.js';
import exportRouter from './routes/export.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.use('/api/projects', projectsRouter);
app.use('/api/projects/:projectId/volumes', volumesRouter);
app.use('/api/projects/:projectId/chapters', chaptersRouter);
app.use('/api/projects/:projectId/characters', charactersRouter);
app.use('/api/projects/:projectId/worldviews', worldviewsRouter);
app.use('/api/projects/:projectId/outlines', outlinesRouter);
app.use('/api/projects/:projectId/stats', statsRouter);
app.use('/api/projects/:projectId/export', exportRouter);
app.use('/api/ai', aiRouter);

app.use(errorHandler);

export default app;
