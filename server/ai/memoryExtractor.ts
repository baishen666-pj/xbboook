import { loadStoredConfig } from './configStore.js';
import { streamChat } from './agentFactory.js';
import { logger } from '../middleware/logger.js';
import * as memoryRepo from '../db/repositories/memoryRepo.js';

interface ExtractedMemory {
  category: string;
  title: string;
  content: string;
  importance: string;
}

const EXTRACTION_PROMPT = `你是一个小说写作助手，负责从章节内容中提取关键记忆点。请分析以下章节内容，提取最重要的信息。

请以 JSON 数组格式返回，每条记忆包含：
- category: 类别，取值范围：plot_event(情节事件), character_state(角色状态变化), setting_detail(设定细节), timeline(时间线), foreshadowing_hint(伏笔暗示), worldbuilding(世界观), other(其他)
- title: 简短标题（10字以内）
- content: 详细描述（50-100字）
- importance: 重要程度 critical/high/normal/low

规则：
1. 只提取对后续写作有参考价值的信息
2. 角色状态变化（受伤、觉醒、获得能力等）标记为 critical 或 high
3. 关键情节转折标记为 critical
4. 新出现的设定信息标记为 normal
5. 最多提取 8 条
6. 只返回 JSON 数组，不要其他文字`;

export async function extractMemories(
  projectId: string,
  chapterId: string,
  chapterTitle: string,
  chapterContent: string,
): Promise<ExtractedMemory[]> {
  const config = loadStoredConfig();
  if (!config.apiKey) {
    logger.warn('AI memory extraction skipped: no API key configured');
    return [];
  }

  const plain = chapterContent
    .replace(/<[^>]+>/g, '')
    .replace(/&[^;]+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (plain.length < 200) return [];

  const truncated = plain.length > 4000 ? plain.slice(0, 4000) + '...' : plain;

  const messages = [
    { role: 'system' as const, content: EXTRACTION_PROMPT },
    {
      role: 'user' as const,
      content: `章节标题：${chapterTitle}\n\n章节内容：\n${truncated}`,
    },
  ];

  try {
    let fullResponse = '';
    for await (const chunk of streamChat(messages, {
      model: config.model || 'deepseek-chat',
      temperature: 0.3,
      maxTokens: 2000,
    })) {
      if (chunk === '[DONE]') break;
      fullResponse += chunk;
    }

    const jsonMatch = fullResponse.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      logger.warn({ chapterId }, 'Memory extraction: no JSON array found in response');
      return [];
    }

    const extracted = JSON.parse(jsonMatch[0]) as ExtractedMemory[];
    const validCategories = new Set(['plot_event', 'character_state', 'setting_detail', 'timeline', 'foreshadowing_hint', 'worldbuilding', 'other']);
    const validImportance = new Set(['critical', 'high', 'normal', 'low']);

    return extracted.filter(m =>
      m.category && validCategories.has(m.category) &&
      m.title && m.content &&
      m.importance && validImportance.has(m.importance),
    );
  } catch (err) {
    logger.error({ err, chapterId }, 'Memory extraction failed');
    return [];
  }
}

export async function extractAndStore(
  projectId: string,
  chapterId: string,
  chapterTitle: string,
  chapterContent: string,
  chapterIndex?: number,
): Promise<number> {
  const memories = await extractMemories(projectId, chapterId, chapterTitle, chapterContent);
  if (memories.length === 0) return 0;

  const entries = memories.map(m => ({
    projectId,
    chapterId,
    category: m.category,
    title: m.title,
    content: m.content,
    importance: m.importance,
    chapterIndex,
    isAutoExtracted: true,
  }));

  const created = memoryRepo.createBatch(entries);
  return created.length;
}
