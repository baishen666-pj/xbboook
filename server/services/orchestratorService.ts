import { getDb } from '../db/database.js';
import { randomUUID } from 'crypto';
import * as chapterRepo from '../db/repositories/chapterRepo.js';
import * as outlineRepo from '../db/repositories/outlineRepo.js';
import { readChapter, writeChapter } from './fileService.js';
import { streamChat } from '../ai/agentFactory.js';
import { buildContext, contextToString } from '../ai/contextBuilder.js';
import { logger } from '../middleware/logger.js';

export interface OrchestratorJob {
  id: string;
  projectId: string;
  status: 'pending' | 'running' | 'paused' | 'done' | 'error';
  currentStep: number;
  totalSteps: number;
  steps: OrchestratorStep[];
  createdAt: string;
  updatedAt: string;
}

export interface OrchestratorStep {
  id: string;
  type: 'generate' | 'consistency_check' | 'polish';
  chapterId?: string;
  chapterTitle?: string;
  status: 'pending' | 'running' | 'done' | 'skipped' | 'error';
  result?: string;
  error?: string;
}

const jobs = new Map<string, OrchestratorJob>();

export function createJob(projectId: string, chapterIds: string[]): OrchestratorJob {
  const db = getDb();
  const steps: OrchestratorStep[] = [];

  for (const chapterId of chapterIds) {
    const chapter = chapterRepo.findById(chapterId);
    if (!chapter) continue;

    steps.push({
      id: randomUUID(),
      type: 'generate',
      chapterId,
      chapterTitle: chapter.title,
      status: 'pending',
    });
  }

  // Add consistency check after all chapters
  if (chapterIds.length > 1) {
    steps.push({
      id: randomUUID(),
      type: 'consistency_check',
      status: 'pending',
    });
  }

  const job: OrchestratorJob = {
    id: randomUUID(),
    projectId,
    status: 'pending',
    currentStep: 0,
    totalSteps: steps.length,
    steps,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  jobs.set(job.id, job);
  return job;
}

export function getJob(jobId: string): OrchestratorJob | undefined {
  return jobs.get(jobId);
}

export async function* runJob(jobId: string): AsyncGenerator<{ type: string; stepIndex: number; status: string; content?: string; error?: string }> {
  const job = jobs.get(jobId);
  if (!job) throw new Error('Job not found');

  job.status = 'running';
  job.updatedAt = new Date().toISOString();

  for (let i = 0; i < job.steps.length; i++) {
    const step = job.steps[i]!;
    job.currentStep = i;

    // Check pause
    if (job.status === 'paused') {
      yield { type: 'paused', stepIndex: i, status: 'paused' };
      return;
    }

    step.status = 'running';
    job.updatedAt = new Date().toISOString();
    yield { type: 'step_start', stepIndex: i, status: 'running' };

    try {
      if (step.type === 'generate') {
        const content = await generateChapter(job.projectId, step.chapterId!);
        step.status = 'done';
        step.result = content;
        yield { type: 'step_done', stepIndex: i, status: 'done', content };
      } else if (step.type === 'consistency_check') {
        const report = await runConsistencyCheck(job.projectId, job.steps.filter(s => s.type === 'generate' && s.chapterId).map(s => s.chapterId!));
        step.status = 'done';
        step.result = report;
        yield { type: 'step_done', stepIndex: i, status: 'done', content: report };
      } else if (step.type === 'polish') {
        const polished = await polishChapter(job.projectId, step.chapterId!);
        step.status = 'done';
        step.result = polished;
        yield { type: 'step_done', stepIndex: i, status: 'done', content: polished };
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      step.status = 'error';
      step.error = message;
      job.status = 'error';
      job.updatedAt = new Date().toISOString();
      yield { type: 'step_error', stepIndex: i, status: 'error', error: message };
      return;
    }
  }

  job.status = 'done';
  job.updatedAt = new Date().toISOString();
  yield { type: 'job_done', stepIndex: job.steps.length - 1, status: 'done' };
}

async function generateChapter(projectId: string, chapterId: string): Promise<string> {
  const sources = await buildContext({
    projectId,
    currentChapterId: chapterId,
    maxTokens: 12000,
  });

  const contextText = contextToString(sources);
  const chapter = chapterRepo.findById(chapterId);
  const chapterTitle = chapter?.title || '未命名章节';

  let existingContent = '';
  try {
    existingContent = await readChapter(projectId, chapterId);
  } catch { /* empty chapter */ }

  const systemPrompt = `你是一位高效的网文写手。根据提供的大纲和上下文，生成一个完整的章节。

要求：
1. 章节标题：${chapterTitle}
2. 长度 1500-3000 字
3. 保持与已有章节的风格一致
4. 人物行为符合角色设定
5. 直接输出章节正文，不加标题`;

  const userPrompt = existingContent.trim()
    ? `以下是已有内容，请在此基础上继续/完善：\n\n${existingContent.slice(-3000)}\n\n项目上下文：\n${contextText}`
    : `请根据以下上下文生成章节内容：\n\n${contextText}`;

  let fullContent = '';
  for await (const chunk of streamChat(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    { temperature: 0.8, maxTokens: 4096 },
  )) {
    if (chunk.content) fullContent += chunk.content;
    if (chunk.done) break;
  }

  await writeChapter(projectId, chapterId, fullContent);
  return fullContent;
}

async function polishChapter(projectId: string, chapterId: string): Promise<string> {
  const content = await readChapter(projectId, chapterId);
  if (!content.trim()) return content;

  let fullContent = '';
  for await (const chunk of streamChat(
    [
      { role: 'system', content: '你是一位专业的文学编辑。请对以下章节进行润色优化，修正语法和用词，增强画面感，但不改变情节。直接输出润色后的文本。' },
      { role: 'user', content: content },
    ],
    { temperature: 0.5, maxTokens: 4096 },
  )) {
    if (chunk.content) fullContent += chunk.content;
    if (chunk.done) break;
  }

  await writeChapter(projectId, chapterId, fullContent);
  return fullContent;
}

async function runConsistencyCheck(projectId: string, chapterIds: string[]): Promise<string> {
  const contents: string[] = [];
  for (const id of chapterIds) {
    try {
      const c = await readChapter(projectId, id);
      const ch = chapterRepo.findById(id);
      contents.push(`【${ch?.title || id}】\n${c.slice(0, 3000)}`);
    } catch { /* skip */ }
  }

  if (contents.length === 0) return '无内容可检查';

  let fullContent = '';
  for await (const chunk of streamChat(
    [
      { role: 'system', content: '你是一位严谨的网文审校编辑。检查以下生成的章节是否存在一致性问题（角色矛盾、时间线错误、设定冲突、情节逻辑漏洞）。列出发现的问题，如果没问题说明"一致性检查通过"。' },
      { role: 'user', content: contents.join('\n\n---\n\n') },
    ],
    { temperature: 0.3, maxTokens: 2000 },
  )) {
    if (chunk.content) fullContent += chunk.content;
    if (chunk.done) break;
  }

  return fullContent;
}

export function pauseJob(jobId: string): boolean {
  const job = jobs.get(jobId);
  if (!job || job.status !== 'running') return false;
  job.status = 'paused';
  job.updatedAt = new Date().toISOString();
  return true;
}

export function resumeJob(jobId: string): boolean {
  const job = jobs.get(jobId);
  if (!job || job.status !== 'paused') return false;
  job.status = 'pending';
  job.updatedAt = new Date().toISOString();
  return true;
}
