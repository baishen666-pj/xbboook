import { findByProject as findChapters } from '../db/repositories/chapterRepo.js';
import { readChapter } from '../services/fileService.js';
import { findByProject as findCharacters, findById as findCharacterById, findRelationsForCharacter } from '../db/repositories/characterRepo.js';
import { findByProject as findArcs } from '../db/repositories/storyArcRepo.js';
import { findByProject as findThreads } from '../db/repositories/plotThreadRepo.js';
import type { Chapter, Character, CharacterRelation } from '../types/index.js';

export interface ContextSource {
  priority: number;
  label: string;
  content: string;
}

export interface BuildContextOptions {
  projectId: string;
  currentChapterId?: string;
  selectedText?: string;
  maxTokens?: number;
  outlineContent?: string;
}

const CHARS_PER_TOKEN = 2.5;

export function estimateTokens(text: string): number {
  if (!text) return 0;
  const cjkCount = (text.match(/[一-鿿㐀-䶿]/g) || []).length;
  const cjkRatio = cjkCount / text.length;
  const effectiveCharsPerToken = cjkRatio * 1.5 + (1 - cjkRatio) * 4.0;
  return Math.ceil(text.length / effectiveCharsPerToken);
}

function getEffectiveCharsPerToken(text: string): number {
  if (!text) return CHARS_PER_TOKEN;
  const cjkCount = (text.match(/[一-鿿㐀-䶿]/g) || []).length;
  const cjkRatio = cjkCount / text.length;
  return cjkRatio * 1.5 + (1 - cjkRatio) * 4.0;
}

export function truncateToTokens(text: string, maxTokens: number): string {
  const effectiveCharsPerToken = getEffectiveCharsPerToken(text);
  const maxChars = Math.floor(maxTokens * effectiveCharsPerToken);
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars);
}

export interface HistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

export function truncateHistory(
  history: HistoryMessage[],
  maxTokens: number,
): HistoryMessage[] {
  if (history.length === 0) return [];

  let totalTokens = 0;
  for (const msg of history) {
    totalTokens += estimateTokens(msg.content) + 4;
  }

  if (totalTokens <= maxTokens) return history;

  const result: HistoryMessage[] = [];
  let remaining = maxTokens;

  for (let i = history.length - 1; i >= 0; i--) {
    const msg = history[i];
    const msgTokens = estimateTokens(msg.content) + 4;

    if (msgTokens > remaining) {
      const available = remaining - 4;
      if (available > 20) {
        result.unshift({
          role: msg.role,
          content: truncateToTokens(msg.content, available),
        });
      }
      break;
    }

    result.unshift(msg);
    remaining -= msgTokens;
  }

  return result;
}

function characterProfiles(characters: Character[]): string {
  if (characters.length === 0) return '';
  return characters
    .map((c) => {
      const parts = [`【${c.name}】`];
      if (c.nickname) parts.push(`别名: ${c.nickname}`);
      parts.push(`角色: ${c.role_type}`);
      if (c.gender) parts.push(`性别: ${c.gender}`);
      if (c.age) parts.push(`年龄: ${c.age}`);
      if (c.appearance) parts.push(`外貌: ${c.appearance}`);
      if (c.personality) parts.push(`性格: ${c.personality}`);
      if (c.background) parts.push(`背景: ${c.background}`);
      if (c.abilities) parts.push(`能力: ${c.abilities}`);
      if (c.speech_style) parts.push(`说话风格: ${c.speech_style}`);
      if (c.verbal_tics) parts.push(`口癖: ${c.verbal_tics}`);
      if (c.vocabulary_level && c.vocabulary_level !== 'common') parts.push(`词汇水平: ${c.vocabulary_level}`);
      if (c.sentence_length_pref && c.sentence_length_pref !== 'medium') parts.push(`句式偏好: ${c.sentence_length_pref}`);
      if (c.emotional_expressiveness && c.emotional_expressiveness !== 'moderate') parts.push(`情感表达: ${c.emotional_expressiveness}`);
      if (c.voice_examples) parts.push(`对话示例:\n${c.voice_examples}`);
      return parts.join('\n');
    })
    .join('\n\n');
}

function buildChapterSummary(chapter: Chapter, index: number): string {
  const summary = chapter.summary || '(无摘要)';
  return `第${index + 1}章「${chapter.title}」— ${summary}`;
}

function lostInMiddleSort(sources: ContextSource[]): ContextSource[] {
  const sorted = [...sources].sort((a, b) => b.priority - a.priority);
  const result: ContextSource[] = [];
  let front = true;

  for (const source of sorted) {
    if (front) {
      result.unshift(source);
    } else {
      result.push(source);
    }
    front = !front;
  }

  return result;
}

export async function buildContext(options: BuildContextOptions): Promise<ContextSource[]> {
  const {
    projectId,
    currentChapterId,
    selectedText,
    maxTokens = 8000,
    outlineContent,
  } = options;

  const sources: ContextSource[] = [];

  // Priority 10: selected text (user is directly working with this)
  if (selectedText) {
    sources.push({
      priority: 10,
      label: '选中内容',
      content: selectedText,
    });
  }

  // Priority 8: current chapter content
  const chapters = findChapters(projectId);
  const currentChapter = currentChapterId
    ? chapters.find((c) => c.id === currentChapterId)
    : undefined;

  if (currentChapter) {
    const content = await readChapter(projectId, currentChapter.id);
    if (content) {
      const idx = chapters.findIndex((c) => c.id === currentChapter.id);
      sources.push({
        priority: 8,
        label: `当前章节「${currentChapter.title}」`,
        content: truncateToTokens(content, Math.floor(maxTokens * 0.4)),
      });

      // Priority 7: previous 2 chapters for continuity
      for (let i = Math.max(0, idx - 2); i < idx; i++) {
        const prev = chapters[i];
        const prevContent = await readChapter(projectId, prev.id);
        if (prevContent) {
          sources.push({
            priority: 7,
            label: `前文「${prev.title}」`,
            content: truncateToTokens(prevContent, Math.floor(maxTokens * 0.15)),
          });
        }
      }
    }
  }

  // Priority 9: outline content (for chapter-generate skill)
  if (outlineContent) {
    sources.push({
      priority: 9,
      label: '大纲内容',
      content: outlineContent,
    });
  }

  // Priority 8: character profiles (elevated — voice consistency is critical)
  const characters = findCharacters(projectId);
  const charText = characterProfiles(characters);
  if (charText) {
    sources.push({
      priority: 8,
      label: '角色设定',
      content: charText,
    });
  }

  // Priority 4: chapter summaries for plot awareness
  if (chapters.length > 0) {
    const summaries = chapters.map((c, i) => buildChapterSummary(c, i)).join('\n');
    sources.push({
      priority: 4,
      label: '章节概要',
      content: summaries,
    });
  }

  // Priority 5: story arcs and plot threads
  let arcs: any[] = [];
  let threads: any[] = [];
  try {
    arcs = findArcs(projectId);
    threads = findThreads(projectId);
  } catch {
    // Tables may not exist in test environments
  }
  if (arcs.length > 0 || threads.length > 0) {
    const arcText = arcs.map(a => `【${a.name}】(${a.status}) ${a.description || ''}`).join('\n');
    const threadText = threads.map(t => `线索「${t.name}」(${t.status}, 优先级: ${t.priority}) ${t.description || ''}`).join('\n');
    sources.push({
      priority: 5,
      label: '故事弧线与情节线索',
      content: [arcText, threadText].filter(Boolean).join('\n'),
    });
  }

  // Apply Lost-in-Middle ordering and budget
  const ordered = lostInMiddleSort(sources);
  let remaining = maxTokens;

  return ordered
    .map((source) => {
      const tokens = estimateTokens(source.content);
      if (tokens > remaining) {
        return {
          ...source,
          content: truncateToTokens(source.content, remaining),
        };
      }
      remaining -= tokens;
      return source;
    })
    .filter((s) => s.content.length > 0);
}

export function characterDialogueProfiles(
  character1: Character,
  character2: Character,
  relations: CharacterRelation[],
): string {
  const profile = (c: Character) => {
    const parts = [`【${c.name}】`];
    if (c.nickname) parts.push(`别名: ${c.nickname}`);
    parts.push(`角色: ${c.role_type}`);
    if (c.gender) parts.push(`性别: ${c.gender}`);
    if (c.age) parts.push(`年龄: ${c.age}`);
    if (c.appearance) parts.push(`外貌: ${c.appearance}`);
    if (c.personality) parts.push(`性格: ${c.personality}`);
    if (c.background) parts.push(`背景: ${c.background}`);
    if (c.abilities) parts.push(`能力: ${c.abilities}`);
    if (c.notes) parts.push(`备注: ${c.notes}`);
    return parts.join('\n');
  };

  const relationText = relations.length > 0
    ? relations
        .map((r) => `${r.relation_type}${r.description ? `：${r.description}` : ''}`)
        .join('\n')
    : '（未设定关系）';

  return [
    '=== 角色A ===',
    profile(character1),
    '',
    '=== 角色B ===',
    profile(character2),
    '',
    '=== 两人关系 ===',
    relationText,
  ].join('\n');
}

export function contextToString(sources: ContextSource[]): string {
  return sources.map((s) => `=== ${s.label} ===\n${s.content}`).join('\n\n');
}
