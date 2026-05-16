import { streamChat } from '../ai/agentFactory.js';
import { isConfigured as checkConfigured } from '../ai/configStore.js';
import { buildContext, characterDialogueProfiles, type BuildContextOptions, type HistoryMessage } from '../ai/contextBuilder.js';
import { buildPrompt, buildUserPrompt, toMessages } from '../ai/promptBuilder.js';
import { getSkill, listSkills, type WritingSkill } from '../ai/writingSkills.js';
import { findById as findCharacterById, findRelationsForCharacter } from '../db/repositories/characterRepo.js';

export interface AiRequest {
  projectId: string;
  skillId: string;
  chapterId?: string;
  selectedText?: string;
  targetStyle?: string;
  question?: string;
  customInstruction?: string;
  outlineContent?: string;
  historyMessages?: HistoryMessage[];
  character1Id?: string;
  character2Id?: string;
}

export { checkConfigured as isConfigured, listSkills, getSkill };
export type { WritingSkill };

export async function* processAiRequest(
  req: AiRequest,
): AsyncGenerator<{ type: 'chunk' | 'done'; content: string }> {
  if (!checkConfigured()) {
    throw new Error('AI 未配置，请设置 AI_API_KEY 环境变量');
  }

  const skill = getSkill(req.skillId);
  if (!skill) throw new Error(`未知技能: ${req.skillId}`);

  const contextOptions: BuildContextOptions = {
    projectId: req.projectId,
    currentChapterId: req.chapterId,
    selectedText: req.selectedText,
    maxTokens: 8000,
    outlineContent: req.outlineContent,
  };

  const sources = await buildContext(contextOptions);

  // Inject character dialogue profiles for character-dialogue skill
  if (req.skillId === 'character-dialogue' && req.character1Id && req.character2Id) {
    const char1 = findCharacterById(req.character1Id);
    const char2 = findCharacterById(req.character2Id);
    if (!char1) throw new Error(`角色未找到: ${req.character1Id}`);
    if (!char2) throw new Error(`角色未找到: ${req.character2Id}`);

    const rels1 = findRelationsForCharacter(req.character1Id);
    const relsBetween = rels1.filter(
      (r) => r.character_a_id === req.character2Id || r.character_b_id === req.character2Id,
    );

    const dialogueProfile = characterDialogueProfiles(char1, char2, relsBetween);
    sources.push({
      priority: 10,
      label: '角色对话设定',
      content: dialogueProfile,
    });
  }

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
    historyMessages: req.historyMessages,
    maxContextTokens: 8000,
  });

  const messages = toMessages(prompt, req.historyMessages, 8000);

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
      return;
    }
  }

  // Fallback: stream ended without done flag
  yield { type: 'done', content: fullContent };
}
