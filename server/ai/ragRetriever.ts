import * as knowledgeChunkRepo from '../db/repositories/knowledgeChunkRepo.js';
import * as memoryRepo from '../db/repositories/memoryRepo.js';
import * as chapterRepo from '../db/repositories/chapterRepo.js';
import * as searchCacheRepo from '../db/repositories/searchCacheRepo.js';
import { readChapter } from '../services/fileService.js';
import { estimateTokens, truncateToTokens } from './contextBuilder.js';
import { logger } from '../middleware/logger.js';

export interface RagResult {
  source: 'knowledge' | 'memory' | 'chapter';
  sourceId: string;
  sourceType: string;
  content: string;
  relevance: number;
  tokenCount: number;
}

function extractKeywords(text: string): string[] {
  const cleaned = text
    .replace(/<[^>]+>/g, '')
    .replace(/[，。！？、；：""''（）《》【】\s]+/g, ' ')
    .trim();

  const segments = cleaned.split(/\s+/).filter(s => s.length >= 2);
  const charPairs: string[] = [];
  for (const seg of segments.slice(0, 3)) {
    if (seg.length >= 2) {
      charPairs.push(seg.substring(0, Math.min(6, seg.length)));
    }
  }

  return [...new Set([...segments.slice(0, 5), ...charPairs])].slice(0, 8);
}

export function retrieve(
  projectId: string,
  query: string,
  options: {
    maxTokens?: number;
    maxResults?: number;
    includeMemory?: boolean;
  } = {},
): RagResult[] {
  const {
    maxTokens = 1500,
    maxResults = 10,
    includeMemory = true,
  } = options;

  const results: RagResult[] = [];
  const keywords = extractKeywords(query);

  // 1. Search knowledge chunks
  for (const kw of keywords.slice(0, 3)) {
    const chunks = knowledgeChunkRepo.search(projectId, kw, maxResults);
    for (const chunk of chunks) {
      if (results.length >= maxResults) break;
      const tokenCount = estimateTokens(chunk.chunk_text);
      results.push({
        source: 'knowledge',
        sourceId: chunk.source_id,
        sourceType: chunk.source_type,
        content: chunk.chunk_text,
        relevance: chunk.relevance,
        tokenCount,
      });
    }
  }

  // 2. Include high-importance memories
  if (includeMemory) {
    const memories = memoryRepo.findRelevant(projectId, 15);
    for (const mem of memories) {
      const tokenCount = estimateTokens(mem.content);
      results.push({
        source: 'memory',
        sourceId: mem.id,
        sourceType: mem.category,
        content: `[${mem.title}] ${mem.content}`,
        relevance: mem.importance === 'critical' ? 3 : 2,
        tokenCount,
      });
    }
  }

  // Deduplicate by sourceId
  const seen = new Set<string>();
  const unique = results.filter(r => {
    const key = `${r.source}:${r.sourceId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Sort by relevance desc
  unique.sort((a, b) => b.relevance - a.relevance);

  // Apply token budget
  let remaining = maxTokens;
  const budgeted: RagResult[] = [];
  for (const r of unique) {
    if (remaining <= 0) break;
    if (r.tokenCount <= remaining) {
      budgeted.push(r);
      remaining -= r.tokenCount;
    } else {
      budgeted.push({
        ...r,
        content: truncateToTokens(r.content, remaining),
        tokenCount: remaining,
      });
      remaining = 0;
    }
  }

  return budgeted;
}

export async function indexChapterKnowledge(
  projectId: string,
  chapterId: string,
  content?: string,
): Promise<number> {
  const text = content ?? await readChapter(projectId, chapterId);
  if (!text) return 0;

  const plain = text.replace(/<[^>]+>/g, '').replace(/&[^;]+;/g, ' ').replace(/\s+/g, ' ').trim();
  if (plain.length < 50) return 0;

  const chunks = knowledgeChunkRepo.indexContent(projectId, 'chapter', chapterId, plain);
  return chunks.length;
}

export async function indexProjectKnowledge(projectId: string): Promise<{ indexed: number; errors: number }> {
  knowledgeChunkRepo.deleteByProject(projectId);

  const chapters = chapterRepo.findByProject(projectId);
  let indexed = 0;
  let errors = 0;

  for (const ch of chapters) {
    try {
      const count = await indexChapterKnowledge(projectId, ch.id);
      indexed += count;
    } catch {
      errors++;
    }
  }

  // Also index character names, worldview titles, etc.
  try {
    const db = (await import('../db/database.js')).getDb();
    const characters = db.prepare('SELECT id, name, personality, background, abilities FROM characters WHERE project_id = ?').all(projectId) as Array<{ id: string; name: string; personality: string; background: string; abilities: string }>;
    for (const ch of characters) {
      const text = [ch.name, ch.personality, ch.background, ch.abilities].filter(Boolean).join(' ');
      if (text.length > 10) {
        knowledgeChunkRepo.indexContent(projectId, 'character', ch.id, text);
        indexed++;
      }
    }

    const worldviews = db.prepare('SELECT id, title, content FROM worldviews WHERE project_id = ?').all(projectId) as Array<{ id: string; title: string; content: string }>;
    for (const wv of worldviews) {
      const text = `${wv.title} ${wv.content || ''}`.trim();
      if (text.length > 10) {
        knowledgeChunkRepo.indexContent(projectId, 'worldview', wv.id, text);
        indexed++;
      }
    }
  } catch (err) {
    logger.warn({ err, projectId }, 'Failed to index metadata for RAG');
  }

  logger.info({ projectId, indexed, errors, total: chapters.length }, 'knowledge index rebuilt');
  return { indexed, errors };
}
