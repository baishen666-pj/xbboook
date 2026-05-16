import { findByProject as findChapters } from '../db/repositories/chapterRepo.js';
import { readChapter } from '../services/fileService.js';
import { findByProject as findCharacters } from '../db/repositories/characterRepo.js';
import type { Chapter, Character } from '../types/index.js';

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

function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

function truncateToTokens(text: string, maxTokens: number): string {
  const maxChars = Math.floor(maxTokens * CHARS_PER_TOKEN);
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars);
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
      return parts.join(' | ');
    })
    .join('\n');
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

  // Priority 6: character profiles
  const characters = findCharacters(projectId);
  const charText = characterProfiles(characters);
  if (charText) {
    sources.push({
      priority: 6,
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

export function contextToString(sources: ContextSource[]): string {
  return sources.map((s) => `=== ${s.label} ===\n${s.content}`).join('\n\n');
}
