import { getSkill } from './writingSkills.js';
import { contextToString, type ContextSource } from './contextBuilder.js';

export interface BuildPromptOptions {
  skillId: string;
  sources: ContextSource[];
  userMessage: string;
  customInstruction?: string;
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

export function buildPrompt(options: BuildPromptOptions): ChatMessages {
  const { skillId, sources, userMessage, customInstruction } = options;

  const skill = getSkill(skillId);
  if (!skill) throw new Error(`Unknown skill: ${skillId}`);

  const systemParts = [skill.systemPrompt];

  if (customInstruction) {
    systemParts.push(`\n额外指令：${customInstruction}`);
  }

  if (sources.length > 0) {
    const contextText = contextToString(sources);
    systemParts.push(`\n参考资料：\n${contextText}`);
  }

  systemParts.push(GLOBAL_SYSTEM_SUFFIX);

  return {
    system: systemParts.join('\n'),
    user: userMessage,
  };
}

export function toMessages(prompt: ChatMessages): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> {
  return [
    { role: 'system', content: prompt.system },
    { role: 'user', content: prompt.user },
  ];
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

    default:
      return params.question || '请协助创作';
  }
}
