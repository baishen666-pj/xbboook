import { getSkill } from './writingSkills.js';
import { contextToString, estimateTokens, truncateToTokens, truncateHistory, type ContextSource, type HistoryMessage } from './contextBuilder.js';

export interface BuildPromptOptions {
  skillId: string;
  sources: ContextSource[];
  userMessage: string;
  customInstruction?: string;
  historyMessages?: HistoryMessage[];
  maxContextTokens?: number;
}

export interface ChatMessages {
  system: string;
  user: string;
}

const GLOBAL_SYSTEM_SUFFIX = `

重要规则：
- 输出纯文本，不使用 Markdown 格式（除非用户明确要求）
- 不要输出类似"好的，以下是为您..."之类的开场白
- 直接输出正文内容，像真正的小说段落一样
- 如果需要分析或建议，使用清晰的中文说明`;

const DEFAULT_MAX_CONTEXT_TOKENS = 8000;
const HISTORY_BUDGET_RATIO = 0.3;
const CONTEXT_BUDGET_RATIO = 0.5;
const USER_BUDGET_RATIO = 0.2;

export function buildPrompt(options: BuildPromptOptions): ChatMessages {
  const { skillId, sources, userMessage, customInstruction, historyMessages, maxContextTokens = DEFAULT_MAX_CONTEXT_TOKENS } = options;

  const skill = getSkill(skillId);
  if (!skill) throw new Error(`Unknown skill: ${skillId}`);

  const systemParts = [skill.systemPrompt];

  if (customInstruction) {
    systemParts.push(`\n额外指令：${customInstruction}`);
  }

  if (sources.length > 0) {
    const contextBudget = Math.floor(maxContextTokens * CONTEXT_BUDGET_RATIO);
    const contextText = contextToString(sources);
    const contextTokens = estimateTokens(contextText);

    if (contextTokens > contextBudget) {
      systemParts.push(`\n参考资料：\n${truncateToTokens(contextText, contextBudget)}`);
    } else {
      systemParts.push(`\n参考资料：\n${contextText}`);
    }
  }

  systemParts.push(GLOBAL_SYSTEM_SUFFIX);

  return {
    system: systemParts.join('\n'),
    user: userMessage,
  };
}

export function toMessages(
  prompt: ChatMessages,
  historyMessages?: HistoryMessage[],
  maxContextTokens?: number,
): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> {
  const result: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: prompt.system },
  ];

  if (historyMessages && historyMessages.length > 0) {
    const budget = Math.floor((maxContextTokens ?? DEFAULT_MAX_CONTEXT_TOKENS) * HISTORY_BUDGET_RATIO);
    const truncated = truncateHistory(historyMessages, budget);
    for (const msg of truncated) {
      result.push({ role: msg.role, content: msg.content });
    }
  }

  result.push({ role: 'user', content: prompt.user });

  return result;
}

export function buildUserPrompt(skillId: string, params: {
  selectedText?: string;
  currentChapterTitle?: string;
  targetStyle?: string;
  question?: string;
}): string {
  switch (skillId) {
    case 'continue':
      return `请续写以下内容（当前章节：${params.currentChapterTitle || '未知'}）`;

    case 'rewrite':
      return `请改写以下选中的文本：\n\n${params.selectedText || ''}`;

    case 'polish':
      return `请润色以下选中的文本：\n\n${params.selectedText || ''}`;

    case 'style':
      return `请将以下文本转换为「${params.targetStyle || '指定'}」风格：\n\n${params.selectedText || ''}`;

    case 'dialogue':
      return `请为当前场景生成角色对话`;

    case 'consistency':
      return `请检查当前内容的一致性，指出任何矛盾或不合理之处`;

    case 'inspiration':
      return `请根据当前情节进展，提供后续发展的灵感建议`;

    case 'qa':
      return params.question || '请回答我的问题';

    case 'deai':
      return `请对以下选中的文本进行去AI味改写，消除机械感使其更像人类写作：\n\n${params.selectedText || ''}`;

    case 'consistency-scan':
      return `请对提供的全文内容和角色设定进行一致性扫描，输出 JSON 格式的问题列表`;

    case 'chapter-generate':
      return `请根据大纲内容生成完整章节草稿`;

    case 'character-dialogue':
      return `请根据角色设定和关系，模拟这两个角色之间的对话场景`;

    case 'style-analysis':
      return `请分析以下选中文本的写作风格：\n\n${params.selectedText || ''}`;

    case 'plot-suggest':
      return '请基于当前情节进展，推荐后续发展方向';

    case 'foreshadowing-track':
      return '请扫描当前内容，识别与已有伏笔相关的段落';

    case 'style-profile':
      return '请分析以下文本并生成结构化风格档案（严格按 JSON 格式输出）：';

    case 'voice-design':
      return '请根据角色设定，生成个性化的语音特征档案（严格按 JSON 格式输出）：';

    case 'long-consistency':
      return '请对提供的跨章节内容进行一致性检查，重点关注角色状态、时间线、设定冲突和情节逻辑';

    case 'auto-continue':
      return `请基于完整项目上下文，为当前章节续写内容（当前章节：${params.currentChapterTitle || '未知'}）`;

    case 'story-analysis':
      return '请分析以下小说内容的故事结构，识别叙事框架、转折点和高潮（严格按 JSON 格式输出）';

    case 'pacing-analysis':
      return '请分析以下章节的写作节奏，检测拖沓和过快的段落（严格按 JSON 格式输出）';

    case 'emotion-arc':
      return '请分析以下章节内容的情感走向，生成情感强度曲线（严格按 JSON 格式输出）';

    case 'character-arc':
      return '请分析以下角色在故事中的发展变化和成长轨迹（严格按 JSON 格式输出）';

    case 'outline-generate':
      return '请根据以下章节内容，反向生成结构化的故事大纲（严格按 JSON 格式输出）';

    case 'expand':
      return `请将以下选中的文本扩写为更丰富、更有细节的段落：\n\n${params.selectedText || ''}`;

    case 'compress':
      return `请将以下选中的文本精简压缩，去除冗余：\n\n${params.selectedText || ''}`;

    case 'check-repetition':
      return `请检查以下文本中的重复表达和冗余之处：\n\n${params.selectedText || ''}`;

    case 'check-dialogue-style':
      return `请检查以下文本中对话的个性化程度和质量：\n\n${params.selectedText || ''}`;

    case 'name-generator':
      return params.question || '请生成适合网文的角色名字（请指定类型风格，如仙侠、都市、玄幻等）';

    case 'place-generator':
      return params.question || '请生成架空世界观的各类名称（地名、门派名、功法名等）';

    case 'plot-card':
      return params.question || '请生成随机情节卡片（请指定类型，如玄幻、都市、悬疑等）';

    case 'inspiration-collision':
      return params.question || '请进行灵感碰撞，随机组合不同领域元素生成创意';

    case 'reader-simulate':
      return params.question || '请从「爽文爱好者」的视角评价以下内容（可指定其他读者类型）';

    default:
      return params.question || '请协助创作';
  }
}
