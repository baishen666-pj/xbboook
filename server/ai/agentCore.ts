import { streamChat, completeChat } from './agentFactory.js';
import { buildContext, contextToString } from './contextBuilder.js';
import * as agentSessionRepo from '../db/repositories/agentSessionRepo.js';
import * as agentDecisionRepo from '../db/repositories/agentDecisionRepo.js';
import * as chapterRepo from '../db/repositories/chapterRepo.js';
import { readChapter, writeChapter } from '../services/fileService.js';
import { logger } from '../middleware/logger.js';

export type AgentStatus = 'idle' | 'planning' | 'drafting' | 'reviewing' | 'revising' | 'paused' | 'completed' | 'failed';
export type DecisionType = 'plan' | 'draft_segment' | 'self_review' | 'revision' | 'accept' | 'reject';

export interface AgentConfig {
  maxIterations: number;
  draftTargetWords: number;
  reviewStrictness: 'low' | 'medium' | 'high';
  enableSelfRevision: boolean;
  styleFingerprintId?: string;
  customInstructions?: string;
}

export interface AgentEvent {
  type: 'status_change' | 'decision' | 'draft_progress' | 'review_result' | 'iteration_complete' | 'error' | 'done';
  sessionId: string;
  data: Record<string, unknown>;
}

interface AgentPlan {
  chapter_goal: string;
  scenes: Array<{
    name: string;
    type: string;
    characters: string[];
    key_events: string[];
    target_words: number;
    emotion: string;
    foreshadowing: string[];
  }>;
  total_target_words: number;
  pacing_note: string;
  cliffhanger_hint: string;
  style_notes: string;
}

interface AgentReview {
  pass: boolean;
  overall_score: number;
  issues: Array<{
    dimension: string;
    severity: string;
    location: string;
    description: string;
    suggestion: string;
  }>;
  highlights: string[];
  revision_strategy: string;
}

const DEFAULT_CONFIG: AgentConfig = {
  maxIterations: 3,
  draftTargetWords: 2500,
  reviewStrictness: 'medium',
  enableSelfRevision: true,
};

const PLAN_PROMPT = `你是一位经验丰富的网文作者，正在为一个章节做写作规划。
基于提供的项目上下文，请输出该章节的写作规划。

严格按照以下 JSON 格式输出（不要加 markdown 代码块标记）：
{
  "chapter_goal": "本章核心目标（一句话）",
  "scenes": [
    {
      "name": "场景名称",
      "type": "action|dialogue|introspection|transition|climax",
      "characters": ["涉及角色名"],
      "key_events": ["关键事件"],
      "target_words": 500,
      "emotion": "紧张|轻松|感动|愤怒|期待|平静",
      "foreshadowing": ["伏笔操作（如果有）"]
    }
  ],
  "total_target_words": 2500,
  "pacing_note": "节奏说明",
  "cliffhanger_hint": "结尾悬念提示",
  "style_notes": "风格注意事项"
}`;

const REVIEW_PROMPT = `你是一位严格的网文审稿编辑。请审查以下由 AI 写作的章节草稿。

审查维度：
1. 角色一致性（性格、说话方式、行为逻辑是否符合设定）
2. 情节连贯性（与前文的衔接、伏笔回收、逻辑通顺）
3. 节奏与张弛（场景切换是否自然，高潮是否有铺垫）
4. 风格匹配度（是否模仿了作者的写作风格）
5. 去AI味（是否有明显的AI生成痕迹）

严格按照以下 JSON 格式输出：
{
  "pass": true,
  "overall_score": 8,
  "issues": [
    {
      "dimension": "角色一致性",
      "severity": "minor",
      "location": "问题所在段落描述",
      "description": "问题描述",
      "suggestion": "修改建议"
    }
  ],
  "highlights": ["写得好的地方"],
  "revision_strategy": "修改策略"
}`;

const SEGMENT_DRAFT_PROMPT = `你是一位正在写作的网文作者。根据规划写出当前场景的内容。

要求：
- 直接输出正文，不加标题或注释
- 保持风格与上下文一致
- 自然融入角色对话和动作描写
- 注意节奏张弛`;

const REVISION_PROMPT = `你是一位网文编辑，请根据审稿意见修改以下章节内容。

要求：
- 只修改有问题的部分，保留写得好的段落
- 保持整体结构和字数基本不变
- 直接输出修改后的完整章节正文`;

const PAUSED_SESSIONS = new Set<string>();

export function createSession(
  projectId: string,
  chapterId: string | null,
  config: Partial<AgentConfig> = {},
): agentSessionRepo.AgentSession {
  const fullConfig: AgentConfig = { ...DEFAULT_CONFIG, ...config };
  return agentSessionRepo.create(projectId, chapterId, fullConfig as Record<string, unknown>, fullConfig.maxIterations);
}

export function getSession(sessionId: string): agentSessionRepo.AgentSession | undefined {
  return agentSessionRepo.findById(sessionId);
}

export function getProjectSessions(projectId: string): agentSessionRepo.AgentSession[] {
  return agentSessionRepo.findByProject(projectId);
}

export function getDecisions(sessionId: string): agentDecisionRepo.AgentDecision[] {
  return agentDecisionRepo.findBySession(sessionId);
}

export function pauseSession(sessionId: string): boolean {
  const session = agentSessionRepo.findById(sessionId);
  if (!session || (session.status !== 'planning' && session.status !== 'drafting' && session.status !== 'reviewing' && session.status !== 'revising')) {
    return false;
  }
  PAUSED_SESSIONS.add(sessionId);
  agentSessionRepo.updateStatus(sessionId, 'paused');
  return true;
}

export function resumeSession(sessionId: string): boolean {
  const session = agentSessionRepo.findById(sessionId);
  if (!session || session.status !== 'paused') return false;
  PAUSED_SESSIONS.delete(sessionId);
  agentSessionRepo.updateStatus(sessionId, 'idle', { current_step: 'resumed' });
  return true;
}

export function cancelSession(sessionId: string): void {
  PAUSED_SESSIONS.delete(sessionId);
  agentSessionRepo.deleteById(sessionId);
}

export async function* runAgentSession(sessionId: string): AsyncGenerator<AgentEvent> {
  const session = agentSessionRepo.findById(sessionId);
  if (!session) throw new Error('Session not found');

  const config: AgentConfig = { ...DEFAULT_CONFIG, ...JSON.parse(session.config) };
  const projectId = session.project_id;
  const chapterId = session.chapter_id;

  if (!chapterId) {
    agentSessionRepo.updateStatus(sessionId, 'failed', { current_step: 'no chapter selected' });
    yield { type: 'error', sessionId, data: { error: '未选择章节' } };
    return;
  }

  const chapter = chapterRepo.findById(chapterId);
  const chapterTitle = chapter?.title || '未命名章节';

  const emit = (type: AgentEvent['type'], data: Record<string, unknown>): AgentEvent => {
    const event: AgentEvent = { type, sessionId, data };
    return event;
  };

  let existingContent = '';
  try {
    existingContent = await readChapter(projectId, chapterId);
  } catch { /* empty chapter */ }

  // Iteration loop
  for (let iteration = 0; iteration < config.maxIterations; iteration++) {
    // Check pause
    if (PAUSED_SESSIONS.has(sessionId)) {
      yield emit('status_change', { status: 'paused', iteration });
      return;
    }

    // === PLANNING PHASE ===
    agentSessionRepo.updateStatus(sessionId, 'planning', { current_step: `规划中 (第${iteration + 1}轮)`, iteration });
    yield emit('status_change', { status: 'planning', iteration });

    const plan = await executePlanning(projectId, chapterId, chapterTitle, existingContent, config);
    if (!plan) {
      agentSessionRepo.updateStatus(sessionId, 'failed', { current_step: 'planning failed' });
      yield emit('error', { error: '规划失败', iteration });
      return;
    }

    agentSessionRepo.updateStatus(sessionId, 'planning', { plan: JSON.stringify(plan) });
    agentDecisionRepo.create(sessionId, iteration, 'plan', `章节: ${chapterTitle}`, plan.chapter_goal, `共${plan.scenes.length}个场景`);

    yield emit('decision', {
      decisionType: 'plan', iteration,
      chapterGoal: plan.chapter_goal,
      sceneCount: plan.scenes.length,
      totalTargetWords: plan.total_target_words,
    });

    // Check pause
    if (PAUSED_SESSIONS.has(sessionId)) {
      yield emit('status_change', { status: 'paused', iteration });
      return;
    }

    // === DRAFTING PHASE ===
    agentSessionRepo.updateStatus(sessionId, 'drafting', { current_step: `撰写中 (第${iteration + 1}轮)`, draft_content: '' });
    yield emit('status_change', { status: 'drafting', iteration });

    const draftContent = await executeDrafting(projectId, chapterId, chapterTitle, existingContent, plan, config);

    // Emit draft progress after drafting completes
    yield emit('draft_progress', { wordCount: draftContent.length, iteration });

    agentSessionRepo.updateStatus(sessionId, 'drafting', { draft_content: draftContent });
    agentDecisionRepo.create(sessionId, iteration, 'draft_segment', `计划${plan.total_target_words}字`, `${draftContent.length}字`, `共${plan.scenes.length}场景`);

    // Check pause
    if (PAUSED_SESSIONS.has(sessionId)) {
      yield emit('status_change', { status: 'paused', iteration });
      return;
    }

    // === REVIEW PHASE ===
    agentSessionRepo.updateStatus(sessionId, 'reviewing', { current_step: `自审中 (第${iteration + 1}轮)` });
    yield emit('status_change', { status: 'reviewing', iteration });

    const review = await executeReview(projectId, chapterId, existingContent, draftContent, config);

    agentSessionRepo.updateStatus(sessionId, 'reviewing', { review_notes: JSON.stringify(review) });
    agentDecisionRepo.create(sessionId, iteration, 'self_review', `${draftContent.length}字草稿`, `评分${review.overall_score}/10`, review.pass ? '通过' : `需修改: ${review.issues.length}个问题`);

    yield emit('review_result', {
      iteration, score: review.overall_score, passed: review.pass,
      issueCount: review.issues.length, highlights: review.highlights,
    });

    // === REVISION PHASE ===
    if (!review.pass && config.enableSelfRevision && iteration < config.maxIterations - 1) {
      agentSessionRepo.updateStatus(sessionId, 'revising', { current_step: `修订中 (第${iteration + 1}轮)` });
      yield emit('status_change', { status: 'revising', iteration });

      const revisedContent = await executeRevision(projectId, chapterId, draftContent, review, config);

      existingContent = revisedContent;
      agentSessionRepo.updateStatus(sessionId, 'revising', { draft_content: revisedContent });
      agentDecisionRepo.create(sessionId, iteration, 'revision', `${review.issues.length}个问题`, `${revisedContent.length}字`, review.revision_strategy);

      yield emit('decision', { decisionType: 'revision', iteration, wordCount: revisedContent.length });
    } else if (review.pass || iteration >= config.maxIterations - 1) {
      // Accept
      const finalContent = review.pass ? draftContent : existingContent || draftContent;
      agentSessionRepo.updateStatus(sessionId, 'completed', {
        final_content: finalContent,
        current_step: '完成',
      });
      agentDecisionRepo.create(sessionId, iteration, 'accept', `${draftContent.length}字`, `${finalContent.length}字`, review.pass ? '审稿通过' : '达到最大迭代次数');

      // Write final content to chapter file
      try {
        await writeChapter(projectId, chapterId, finalContent);
      } catch (err) {
        logger.error({ err, sessionId }, 'Failed to write chapter');
      }

      yield emit('iteration_complete', { iteration, final: true, wordCount: finalContent.length });
      yield emit('done', { wordCount: finalContent.length, iterations: iteration + 1, score: review.overall_score });
      return;
    }

    yield emit('iteration_complete', { iteration, final: false });

    // Prepare for next iteration
    existingContent = existingContent || draftContent;
  }

  // Should not reach here, but just in case
  agentSessionRepo.updateStatus(sessionId, 'completed', { current_step: '达到最大迭代次数' });
  yield emit('done', { iterations: config.maxIterations });
}

async function executePlanning(
  projectId: string,
  chapterId: string,
  chapterTitle: string,
  existingContent: string,
  config: AgentConfig,
): Promise<AgentPlan | null> {
  try {
    const sources = await buildContext({
      projectId,
      currentChapterId: chapterId,
      maxTokens: 10000,
    });
    const contextText = contextToString(sources);

    const userPrompt = existingContent.trim()
      ? `章节标题：${chapterTitle}\n\n已有内容（最后3000字）：\n${existingContent.slice(-3000)}\n\n项目上下文：\n${contextText}`
      : `章节标题：${chapterTitle}\n\n请根据以下上下文规划章节：\n\n${contextText}`;

    const result = await completeChat(
      [
        { role: 'system', content: PLAN_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      { maxTokens: 2000, temperature: 0.7 },
    );

    const cleaned = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned) as AgentPlan;
  } catch (err) {
    logger.error({ err, projectId, chapterId }, 'Agent planning failed');
    return null;
  }
}

async function executeDrafting(
  projectId: string,
  chapterId: string,
  chapterTitle: string,
  existingContent: string,
  plan: AgentPlan,
  config: AgentConfig,
): Promise<string> {
  const sources = await buildContext({
    projectId,
    currentChapterId: chapterId,
    maxTokens: 8000,
  });
  const contextText = contextToString(sources);
  const planStr = JSON.stringify(plan, null, 2);

  let fullDraft = existingContent.trim() ? existingContent + '\n\n' : '';

  for (let i = 0; i < plan.scenes.length; i++) {
    const scene = plan.scenes[i]!;

    const scenePrompt = `${SEGMENT_DRAFT_PROMPT}

当前场景规划：
${JSON.stringify(scene, null, 2)}

${config.customInstructions ? `额外要求：${config.customInstructions}\n` : ''}
${plan.style_notes ? `风格注意：${plan.style_notes}\n` : ''}
项目上下文：${contextText.slice(-6000)}`;

    let sceneContent = '';
    for await (const chunk of streamChat(
      [
        { role: 'system', content: scenePrompt },
        { role: 'user', content: `已有内容：\n${fullDraft.slice(-3000)}\n\n请接着写"${scene.name}"场景（目标${scene.target_words}字）` },
      ],
      { temperature: 0.85, maxTokens: 2000 },
    )) {
      if (chunk.content) sceneContent += chunk.content;
      if (chunk.done) break;
    }

    fullDraft += sceneContent;
  }

  return fullDraft.trim();
}

async function executeReview(
  projectId: string,
  chapterId: string,
  previousContent: string,
  draftContent: string,
  config: AgentConfig,
): Promise<AgentReview> {
  const strictnessNote = config.reviewStrictness === 'high'
    ? '请非常严格地审查，小问题也要指出。'
    : config.reviewStrictness === 'low'
      ? '请宽松审查，只有严重问题才指出。'
      : '';

  const result = await completeChat(
    [
      { role: 'system', content: `${REVIEW_PROMPT}\n\n${strictnessNote}` },
      { role: 'user', content: `${previousContent.trim() ? `前文参考：\n${previousContent.slice(-2000)}\n\n---\n\n` : ''}草稿内容：\n${draftContent}` },
    ],
    { maxTokens: 2000, temperature: 0.3 },
  );

  try {
    const cleaned = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned) as AgentReview;
  } catch {
    // If parsing fails, treat as pass with low score
    return {
      pass: false,
      overall_score: 5,
      issues: [{ dimension: '解析', severity: 'major', location: '全部', description: '审稿结果解析失败', suggestion: '重新审查' }],
      highlights: [],
      revision_strategy: '重新审查',
    };
  }
}

async function executeRevision(
  projectId: string,
  chapterId: string,
  draftContent: string,
  review: AgentReview,
  config: AgentConfig,
): Promise<string> {
  const issuesStr = review.issues.map(i => `[${i.severity}] ${i.dimension}: ${i.description} → ${i.suggestion}`).join('\n');

  let fullContent = '';
  for await (const chunk of streamChat(
    [
      { role: 'system', content: REVISION_PROMPT },
      { role: 'user', content: `审稿意见：\n${issuesStr}\n\n修改策略：${review.revision_strategy}\n\n原文：\n${draftContent}` },
    ],
    { temperature: 0.6, maxTokens: 4096 },
  )) {
    if (chunk.content) fullContent += chunk.content;
    if (chunk.done) break;
  }

  return fullContent.trim() || draftContent;
}
