import { streamChat } from '../ai/agentFactory.js';
import { buildContext, contextToString, estimateTokens, truncateToTokens, type ContextSource, type HistoryMessage } from '../ai/contextBuilder.js';
import { getSkill } from '../ai/writingSkills.js';
import { buildPrompt, toMessages } from '../ai/promptBuilder.js';
import * as chapterRepo from '../db/repositories/chapterRepo.js';
import { readChapter } from './fileService.js';
import { logger } from '../middleware/logger.js';

export interface AnalysisRequest {
  projectId: string;
  analysisType: 'story-analysis' | 'pacing-analysis' | 'emotion-arc' | 'character-arc' | 'outline-generate';
  chapterIds?: string[];
  characterId?: string;
}

export interface AnalysisResult {
  analysisType: string;
  result: unknown;
  chaptersAnalyzed: number;
  tokensUsed: number;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function gatherChapterContent(
  projectId: string,
  chapterIds?: string[],
  maxChars = 30000,
): Promise<Array<{ title: string; content: string; index: number }>> {
  const chapters = chapterRepo.findByProject(projectId);
  const target = chapterIds
    ? chapters.filter(c => chapterIds.includes(c.id))
    : chapters;

  const results: Array<{ title: string; content: string; index: number }> = [];
  let totalChars = 0;

  for (let i = 0; i < target.length; i++) {
    if (totalChars >= maxChars) break;
    try {
      const raw = await readChapter(projectId, target[i].id);
      const plain = stripHtml(raw);
      if (plain.length > 0) {
        const remaining = maxChars - totalChars;
        const content = plain.length > remaining ? plain.slice(0, remaining) + '...' : plain;
        results.push({
          title: target[i].title,
          content,
          index: chapters.findIndex(c => c.id === target[i].id),
        });
        totalChars += content.length;
      }
    } catch {
      // skip unreadable chapters
    }
  }

  return results;
}

export async function runAnalysis(req: AnalysisRequest): Promise<AnalysisResult> {
  const skill = getSkill(req.analysisType);
  if (!skill) throw new Error(`未知分析类型: ${req.analysisType}`);

  const chapterContents = await gatherChapterContent(req.projectId, req.chapterIds);
  if (chapterContents.length === 0) {
    throw new Error('没有可分析的章节内容');
  }

  const contentText = chapterContents
    .map((c, i) => `=== 第${c.index + 1}章「${c.title}」===\n${c.content}`)
    .join('\n\n');

  const sources: ContextSource[] = await buildContext({
    projectId: req.projectId,
    maxTokens: 6000,
    disabledSources: ['选中内容', 'RAG检索', '章节概要'],
  });

  const contextText = contextToString(sources);
  const systemPrompt = skill.systemPrompt;

  const messages = [
    {
      role: 'system' as const,
      content: `${systemPrompt}\n\n项目上下文：\n${truncateToTokens(contextText, 4000)}`,
    },
    {
      role: 'user' as const,
      content: `以下是小说的章节内容（共 ${chapterContents.length} 章）：\n\n${truncateToTokens(contentText, 20000)}`,
    },
  ];

  let fullResponse = '';
  for await (const chunk of streamChat(messages, {
    temperature: skill.temperature,
    maxTokens: skill.maxTokens,
  })) {
    if (chunk.content) fullResponse += chunk.content;
    if (chunk.done) break;
  }

  const jsonMatch = fullResponse.match(/\{[\s\S]*\}/);
  const result = jsonMatch ? JSON.parse(jsonMatch[0]) : { raw: fullResponse };

  return {
    analysisType: req.analysisType,
    result,
    chaptersAnalyzed: chapterContents.length,
    tokensUsed: estimateTokens(fullResponse),
  };
}

export async function quickAnalysis(
  projectId: string,
  type: 'structure' | 'pacing' | 'emotion' | 'character' | 'outline',
): Promise<{ scores: Record<string, number>; summary: string }> {
  const chapters = chapterRepo.findByProject(projectId);
  if (chapters.length === 0) {
    return { scores: {}, summary: '暂无章节可供分析' };
  }

  const totalWords = chapters.reduce((sum, c) => sum + (c.word_count || 0), 0);
  const avgWords = chapters.length > 0 ? Math.round(totalWords / chapters.length) : 0;

  const wordVariance = chapters.length > 1
    ? Math.sqrt(chapters.reduce((sum, c) => sum + Math.pow((c.word_count || 0) - avgWords, 2), 0) / chapters.length)
    : 0;

  const scores: Record<string, number> = {
    totalChapters: chapters.length,
    totalWords,
    avgWordsPerChapter: avgWords,
    wordVariance: Math.round(wordVariance),
    volumeCount: new Set(chapters.map(c => c.volume_id).filter(Boolean)).size,
  };

  const summary = `${chapters.length} 章 · ${totalWords.toLocaleString()} 字 · 平均 ${avgWords} 字/章`;

  return { scores, summary };
}
