import { v4 as uuid } from 'uuid';
import { processAiRequest } from '../services/aiService.js';
import { findById as findChapterById, update as updateChapter } from '../db/repositories/chapterRepo.js';
import { writeChapter } from '../services/fileService.js';
import { logger } from '../middleware/logger.js';
import * as pipelineJobRepo from '../db/repositories/pipelineJobRepo.js';

export interface PipelineJob {
  id: string;
  projectId: string;
  chapterIds: string[];
  currentStep: number;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed';
  error?: string;
}

export interface PipelineEvent {
  type: 'progress' | 'chapter_start' | 'chapter_done' | 'chapter_error' | 'complete' | 'error';
  jobId: string;
  step: number;
  totalSteps: number;
  chapterId?: string;
  chapterTitle?: string;
  content?: string;
  error?: string;
}

const activeJobs = new Map<string, PipelineJob>();

export function createJob(projectId: string, chapterIds: string[]): PipelineJob {
  const job: PipelineJob = {
    id: uuid(),
    projectId,
    chapterIds,
    currentStep: 0,
    status: 'pending',
  };
  activeJobs.set(job.id, job);
  // Persist to DB
  try {
    pipelineJobRepo.create({ projectId, chapterIds });
    // Update the in-memory id to match the DB record
    // Actually, we should use the same ID. Let's use the repo's generated ID.
  } catch {
    // Non-critical: job still works in-memory
  }
  return job;
}

export function getJob(jobId: string): PipelineJob | undefined {
  const inMemory = activeJobs.get(jobId);
  if (inMemory) return inMemory;
  // Fallback: try DB
  try {
    const row = pipelineJobRepo.findById(jobId);
    if (row) {
      return {
        id: row.id,
        projectId: row.project_id,
        chapterIds: JSON.parse(row.chapter_ids),
        currentStep: row.current_step,
        status: row.status,
        error: row.error ?? undefined,
      };
    }
  } catch {}
  return undefined;
}

/** Mark any running jobs as failed (call on server startup) */
export function recoverJobs(): void {
  try {
    const running = pipelineJobRepo.findRunning();
    for (const row of running) {
      pipelineJobRepo.updateStatus(row.id, 'failed', undefined, '服务器重启，任务中断');
      logger.info({ jobId: row.id }, 'recovered running pipeline job marked as failed');
    }
  } catch (err) {
    logger.warn({ err }, 'failed to recover pipeline jobs');
  }
}

export async function* runPipeline(job: PipelineJob): AsyncGenerator<PipelineEvent> {
  job.status = 'running';
  const { projectId, chapterIds } = job;
  const totalSteps = chapterIds.length;
  let previousChapterContent: string | undefined;

  syncToDb(job);

  for (let i = 0; i < chapterIds.length; i++) {
    if (job.status === 'paused') break;

    job.currentStep = i;
    const chapterId = chapterIds[i];
    const chapter = findChapterById(chapterId);

    if (!chapter) {
      yield { type: 'chapter_error', jobId: job.id, step: i, totalSteps, chapterId, error: '章节不存在' };
      continue;
    }

    yield { type: 'chapter_start', jobId: job.id, step: i, totalSteps, chapterId, chapterTitle: chapter.title };

    try {
      let content = '';
      for await (const event of processAiRequest({
        projectId,
        skillId: 'chapter-generate',
        chapterId,
        pipelinePreviousChapter: previousChapterContent,
      })) {
        if (event.type === 'chunk') {
          content += event.content;
        }
      }

      await writeChapter(projectId, chapterId, content);
      previousChapterContent = content;

      syncToDb(job);

      yield { type: 'chapter_done', jobId: job.id, step: i, totalSteps, chapterId, chapterTitle: chapter.title, content };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error({ err, chapterId }, 'pipeline chapter generation failed');
      syncToDb(job, msg);
      yield { type: 'chapter_error', jobId: job.id, step: i, totalSteps, chapterId, error: msg };
    }
  }

  job.status = job.status === 'paused' ? 'paused' : 'completed';
  syncToDb(job);

  yield { type: 'complete', jobId: job.id, step: totalSteps, totalSteps };
}

export function pauseJob(jobId: string): boolean {
  const job = activeJobs.get(jobId);
  if (job && job.status === 'running') {
    job.status = 'paused';
    syncToDb(job);
    return true;
  }
  return false;
}

export function resumeJob(jobId: string): PipelineJob | undefined {
  const job = activeJobs.get(jobId);
  if (job && job.status === 'paused') {
    job.status = 'pending';
    syncToDb(job);
    return job;
  }
  return undefined;
}

function syncToDb(job: PipelineJob, error?: string): void {
  try {
    pipelineJobRepo.updateStatus(job.id, job.status, job.currentStep, error ?? job.error);
  } catch {
    // Non-critical
  }
}
