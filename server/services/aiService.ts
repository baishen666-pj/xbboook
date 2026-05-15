import { streamChat, isConfigured } from '../ai/agentFactory.js';
import { buildContext, type BuildContextOptions } from '../ai/contextBuilder.js';
import { buildPrompt, buildUserPrompt, toMessages } from '../ai/promptBuilder.js';
import { getSkill, listSkills, type WritingSkill } from '../ai/writingSkills.js';
import type { StreamChunk } from '../ai/agentFactory.js';

export interface AiRequest {
  projectId: string;
  skillId: string;
  chapterId?: string;
  selectedText?: string;
  targetStyle?: string;
  question?: string;
  customInstruction?: string;
}

export { isConfigured, listSkills, getSkill };
export type { WritingSkill };

export async function* processAiRequest(
  req: AiRequest,
): AsyncGenerator<{ type: 'chunk' | 'done'; content: string }> {
  if (!isConfigured()) {
    throw new Error('AI 未配置，请设置 AI_API_KEY 环境变量');
  }

  const skill = getSkill(req.skillId);
  if (!skill) throw new Error(`未知技能: ${req.skillId}`);

  const contextOptions: BuildContextOptions = {
    projectId: req.projectId,
    currentChapterId: req.chapterId,
    selectedText: req.selectedText,
    maxTokens: 8000,
  };

  const sources = buildContext(contextOptions);
  const userPrompt = buildUserPrompt(req.skillId, {
    selectedText: req.selectedText,
    currentChapterTitle: sources.find((s) => s.label.startsWith('当前章节'))?.label?.replace('当前章节', '').replace(/[「」]/g, ''),
    targetStyle: req.targetStyle,
    question: req.question,
  });

  const prompt = buildPrompt({
    skillId: req.skillId,
    sources,
    userMessage: userPrompt,
    customInstruction: req.customInstruction,
  });

  const messages = toMessages(prompt);

  let fullContent = '';

  for await (const chunk of streamChat(messages, {
    temperature: skill.temperature,
    maxTokens: skill.maxTokens,
  })) {
    if (chunk.content) {
      fullContent += chunk.content;
      yield { type: 'chunk', content: chunk.content };
    }
    if (chunk.done) {
      yield { type: 'done', content: fullContent };
    }
  }

  if (!fullContent.endsWith('\n')) {
    yield { type: 'done', content: fullContent };
  }
}
