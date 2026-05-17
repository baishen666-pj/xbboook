import { streamChat, completeChat } from './agentFactory.js';
import { buildContext, contextToString } from './contextBuilder.js';
import * as chapterRepo from '../db/repositories/chapterRepo.js';
import { readChapter, writeChapter } from '../services/fileService.js';
import { logger } from '../middleware/logger.js';
import type { WorkflowStep } from '../db/repositories/agentWorkflowRepo.js';

export interface WorkflowEvent {
  type: 'step_start' | 'step_done' | 'step_error' | 'step_skip' | 'done';
  stepIndex: number;
  stepName: string;
  stepType: string;
  content?: string;
  error?: string;
}

export async function* runWorkflow(
  projectId: string,
  chapterId: string,
  steps: WorkflowStep[],
  existingContent: string,
): AsyncGenerator<WorkflowEvent> {
  const chapter = chapterRepo.findById(chapterId);
  const chapterTitle = chapter?.title || '未命名章节';
  let currentContent = existingContent;
  let lastReviewPassed = true;
  let lastReviewScore = 10;

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]!;

    // Check condition
    if (step.condition === 'review_failed' && lastReviewPassed) {
      yield { type: 'step_skip', stepIndex: i, stepName: step.name, stepType: step.type };
      continue;
    }
    if (step.condition === 'review_score_below_7' && lastReviewScore >= 7) {
      yield { type: 'step_skip', stepIndex: i, stepName: step.name, stepType: step.type };
      continue;
    }

    yield { type: 'step_start', stepIndex: i, stepName: step.name, stepType: step.type };

    try {
      const sources = await buildContext({
        projectId,
        currentChapterId: chapterId,
        maxTokens: 8000,
      });
      const contextText = contextToString(sources);

      const messages = [
        { role: 'system' as const, content: `${step.prompt}\n\n章节标题：${chapterTitle}` },
        { role: 'user' as const, content: currentContent.trim() ? `已有内容：\n${currentContent.slice(-4000)}\n\n项目上下文：\n${contextText.slice(-4000)}` : `请根据上下文生成章节内容：\n\n${contextText}` },
      ];

      if (step.type === 'review') {
        // Non-streaming for review (needs structured output)
        const result = await completeChat(messages, {
          providerId: step.providerId,
          temperature: step.temperature,
          maxTokens: step.maxTokens,
        });

        // Simple pass/fail detection
        lastReviewPassed = !result.includes('不通过') && !result.includes('失败') && (result.includes('通过') || result.includes('合格'));
        lastReviewScore = lastReviewPassed ? 8 : 5;

        yield { type: 'step_done', stepIndex: i, stepName: step.name, stepType: step.type, content: result };
      } else {
        // Streaming for generation steps
        let fullContent = '';
        for await (const chunk of streamChat(messages, {
          providerId: step.providerId,
          temperature: step.temperature,
          maxTokens: step.maxTokens,
        })) {
          if (chunk.content) fullContent += chunk.content;
          if (chunk.done) break;
        }

        if (step.type === 'generate' || step.type === 'plan') {
          currentContent = fullContent;
        } else if (step.type === 'revise' || step.type === 'polish' || step.type === 'deai' || step.type === 'custom') {
          if (fullContent.length > currentContent.length * 0.3) {
            currentContent = fullContent;
          }
        }

        yield { type: 'step_done', stepIndex: i, stepName: step.name, stepType: step.type, content: currentContent };
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      yield { type: 'step_error', stepIndex: i, stepName: step.name, stepType: step.type, error: message };
    }
  }

  // Write final content
  try {
    await writeChapter(projectId, chapterId, currentContent);
  } catch (err) {
    logger.error({ err }, 'Failed to write chapter after workflow');
  }

  yield { type: 'done', stepIndex: steps.length - 1, stepName: '完成', stepType: 'done', content: currentContent };
}
