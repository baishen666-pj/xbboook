import { v4 as uuid } from 'uuid';
import { processAiRequest } from '../services/aiService.js';
import { findById as findChapterById, update as updateChapter } from '../db/repositories/chapterRepo.js';
import { writeChapter } from '../services/fileService.js';
import { logger } from '../middleware/logger.js';

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
  return job;
}

export function getJob(jobId: string): PipelineJob | undefined {
  return activeJobs.get(jobId);
}

export async function* runPipeline(job: PipelineJob): AsyncGenerator<PipelineEvent> {
  job.status = 'running';
  const { projectId, chapterIds } = job;
  const totalSteps = chapterIds.length;

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
      })) {
        if (event.type === 'chunk') {
          content += event.content;
        }
      }

      await writeChapter(projectId, chapterId, content);

      yield { type: 'chapter_done', jobId: job.id, step: i, totalSteps, chapterId, chapterTitle: chapter.title, content };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error({ err, chapterId }, 'pipeline chapter generation failed');
      yield { type: 'chapter_error', jobId: job.id, step: i, totalSteps, chapterId, error: msg };
    }
  }

  job.status = job.status === 'paused' ? 'paused' : 'completed';
  yield { type: 'complete', jobId: job.id, step: totalSteps, totalSteps };
}

export function pauseJob(jobId: string): boolean {
  const job = activeJobs.get(jobId);
  if (job && job.status === 'running') {
    job.status = 'paused';
    return true;
  }
  return false;
}

export function resumeJob(jobId: string): PipelineJob | undefined {
  const job = activeJobs.get(jobId);
  if (job && job.status === 'paused') {
    job.status = 'pending';
    return job;
  }
  return undefined;
}