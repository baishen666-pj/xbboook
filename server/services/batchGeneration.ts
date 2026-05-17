import { completeChat } from '../ai/agentFactory.js';
import { buildContext, contextToString } from '../ai/contextBuilder.js';
import * as outlineRepo from '../db/repositories/outlineRepo.js';
import * as chapterRepo from '../db/repositories/chapterRepo.js';
import { readChapter } from './fileService.js';
import { logger } from '../middleware/logger.js';
import * as batchJobRepo from '../db/repositories/batchJobRepo.js';

export interface BatchPlanChapter {
  outlineNodeId: string;
  title: string;
  synopsis: string;
  sortOrder: number;
}

export interface BatchPlan {
  chapters: BatchPlanChapter[];
  projectId: string;
  temperature: number;
}

export interface BatchProgressEvent {
  type: 'chapter_start' | 'chapter_progress' | 'chapter_done' | 'consistency_check' | 'chapter_revise' | 'batch_done' | 'batch_error';
  chapterIndex: number;
  chapterTitle: string;
  data?: unknown;
}

export async function generateBatchPlan(
  projectId: string,
  options?: { temperature?: number },
): Promise<BatchPlan> {
  const outlines = outlineRepo.findByProject(projectId);
  const chapters = chapterRepo.findByProject(projectId);

  const existingTitles = new Set(chapters.map(c => c.title));
  const existingOutlineRefs = new Set(chapters.map(c => {
    const outline = outlines.find(o => o.title === c.title);
    return outline?.id;
  }).filter(Boolean));

  const batchChapters: BatchPlanChapter[] = outlines
    .filter(o => !existingOutlineRefs.has(o.id) && !existingTitles.has(o.title))
    .map((o, i) => ({
      outlineNodeId: o.id,
      title: o.title,
      synopsis: o.content || '',
      sortOrder: o.sort_order + i,
    }));

  return {
    chapters: batchChapters,
    projectId,
    temperature: options?.temperature ?? 0.8,
  };
}

export async function* runBatchGeneration(
  jobId: string,
  plan: BatchPlan,
): AsyncGenerator<BatchProgressEvent> {
  const { chapters, projectId, temperature } = plan;

  if (chapters.length === 0) {
    yield {
      type: 'batch_done',
      chapterIndex: 0,
      chapterTitle: '',
      data: { totalChapters: 0, totalWords: 0 },
    };
    return;
  }

  batchJobRepo.updateStatus(jobId, 'running');
  let previousChapterContent = '';
  let totalWords = 0;
  const progressData: { completed: number; results: Array<{ title: string; words: number }> } = {
    completed: 0,
    results: [],
  };

  try {
    // Load previous chapter content for continuity
    const existingChapters = chapterRepo.findByProject(projectId);
    if (existingChapters.length > 0) {
      const lastChapter = existingChapters[existingChapters.length - 1]!;
      previousChapterContent = await readChapter(projectId, lastChapter.id);
    }

    for (let i = 0; i < chapters.length; i++) {
      // Check if job was paused or cancelled
      const job = batchJobRepo.findById(jobId);
      if (!job || job.status === 'cancelled') {
        yield {
          type: 'batch_error',
          chapterIndex: i,
          chapterTitle: chapters[i]!.title,
          data: { error: 'Job was cancelled' },
        };
        return;
      }
      if (job.status === 'paused') {
        yield {
          type: 'batch_error',
          chapterIndex: i,
          chapterTitle: chapters[i]!.title,
          data: { error: 'Job was paused', paused: true },
        };
        return;
      }

      const chapter = chapters[i]!;

      yield {
        type: 'chapter_start',
        chapterIndex: i,
        chapterTitle: chapter.title,
      };

      try {
        // Build context
        const sources = await buildContext({
          projectId,
          maxTokens: 8000,
          pipelinePreviousChapter: previousChapterContent.slice(-4000) || undefined,
        });
        const contextText = contextToString(sources);

        // Generate chapter content
        const systemPrompt = `你是一位网文章节生成专家。请根据提供的大纲节点和上下文，生成完整的章节内容。
要求：
- 保持与前文的连贯性
- 角色行为符合已设定性格
- 情节推进合理
- 字数2000-3000字
- 直接输出章节正文，不要输出标题`;

        const userPrompt = `章节标题：${chapter.title}
章节大纲：${chapter.synopsis || '无具体大纲'}
${contextText ? `\n项目上下文：\n${contextText.slice(-6000)}` : ''}
${previousChapterContent ? `\n上一章内容（最后2000字）：\n${previousChapterContent.slice(-2000)}` : ''}`;

        const content = await completeChat(
          [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          { temperature, maxTokens: 4096 },
        );

        if (!content || content.length < 100) {
          throw new Error(`Generated content too short (${content?.length ?? 0} chars)`);
        }

        // Consistency check with previous chapter
        let finalContent = content;
        if (previousChapterContent && i > 0) {
          const checkResult = await completeChat(
            [
              {
                role: 'system',
                content: '你是一位严谨的网文审校编辑。请对比前后两章内容，检查是否有明显的连贯性问题（角色行为矛盾、场景跳跃、称呼不一致等）。如果没有问题，回复"通过"。如果有问题，请简要说明并提供修改后的章节全文。',
              },
              {
                role: 'user',
                content: `上一章末尾：\n${previousChapterContent.slice(-1500)}\n\n本章全文：\n${content}`,
              },
            ],
            { temperature: 0.3, maxTokens: 4096 },
          );

          yield {
            type: 'consistency_check',
            chapterIndex: i,
            chapterTitle: chapter.title,
            data: { result: checkResult },
          };

          if (checkResult.includes('问题') && !checkResult.includes('通过') && !checkResult.includes('无问题')) {
            const revisedContent = await completeChat(
              [
                {
                  role: 'system',
                  content: '请根据审校意见修改章节内容，修正指出的连贯性问题，输出完整的修改后章节正文。',
                },
                {
                  role: 'user',
                  content: `原始章节：\n${content}\n\n审校意见：\n${checkResult}`,
                },
              ],
              { temperature: 0.6, maxTokens: 4096 },
            );

            if (revisedContent && revisedContent.length > content.length * 0.5) {
              finalContent = revisedContent;
              yield {
                type: 'chapter_revise',
                chapterIndex: i,
                chapterTitle: chapter.title,
                data: { reason: checkResult.slice(0, 200) },
              };
            }
          }
        }

        // Create chapter in DB and write file
        const newChapter = await chapterRepo.create({
          projectId,
          title: chapter.title,
          summary: chapter.synopsis,
        });

        await chapterRepo.updateContent(newChapter.id, finalContent);

        totalWords += finalContent.length;
        previousChapterContent = finalContent;

        // Update progress
        progressData.completed = i + 1;
        progressData.results.push({ title: chapter.title, words: finalContent.length });
        batchJobRepo.updateProgress(jobId, JSON.stringify(progressData), i);

        yield {
          type: 'chapter_done',
          chapterIndex: i,
          chapterTitle: chapter.title,
          data: {
            chapterId: newChapter.id,
            wordCount: finalContent.length,
            totalWords,
            progress: i + 1,
            total: chapters.length,
          },
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        logger.error({ err, chapterIndex: i, chapterTitle: chapter.title }, 'Batch generation chapter failed');

        yield {
          type: 'chapter_error',
          chapterIndex: i,
          chapterTitle: chapter.title,
          data: { error: message },
        } as BatchProgressEvent;

        // Continue to next chapter instead of failing entire batch
        progressData.completed = i + 1;
        progressData.results.push({ title: chapter.title, words: 0 });
        batchJobRepo.updateProgress(jobId, JSON.stringify(progressData), i);
      }
    }

    // Mark job as completed
    batchJobRepo.updateStatus(jobId, 'completed');

    yield {
      type: 'batch_done',
      chapterIndex: chapters.length - 1,
      chapterTitle: '',
      data: {
        totalChapters: chapters.length,
        totalWords,
        completedChapters: progressData.results.filter(r => r.words > 0).length,
        failedChapters: progressData.results.filter(r => r.words === 0).length,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    batchJobRepo.updateStatus(jobId, 'failed', message);

    yield {
      type: 'batch_error',
      chapterIndex: 0,
      chapterTitle: '',
      data: { error: message },
    };
  }
}

export function pauseBatch(jobId: string): batchJobRepo.BatchJob | undefined {
  const job = batchJobRepo.findById(jobId);
  if (!job) return undefined;
  if (job.status !== 'running') return undefined;
  return batchJobRepo.updateStatus(jobId, 'paused');
}

export function resumeBatch(jobId: string): batchJobRepo.BatchJob | undefined {
  const job = batchJobRepo.findById(jobId);
  if (!job) return undefined;
  if (job.status !== 'paused') return undefined;
  return batchJobRepo.updateStatus(jobId, 'running');
}
