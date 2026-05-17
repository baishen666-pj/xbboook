import { completeChat } from '../ai/agentFactory.js';
import { buildContext, contextToString, truncateToTokens } from '../ai/contextBuilder.js';
import { getSkill } from '../ai/writingSkills.js';
import * as chapterRepo from '../db/repositories/chapterRepo.js';
import * as characterRepo from '../db/repositories/characterRepo.js';
import { readChapter } from './fileService.js';
import { logger } from '../middleware/logger.js';

export interface ExtractedRelation {
  characterA: string;
  characterB: string;
  relationType: string;
  description: string;
  confidence: number;
  keyEvents: string[];
}

export interface ExtractionResult {
  relations: ExtractedRelation[];
  factions: Array<{ name: string; members: string[] }>;
  chaptersProcessed: number;
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

async function gatherContent(
  projectId: string,
  chapterIds?: string[],
  maxChars = 30000,
): Promise<string> {
  const chapters = chapterRepo.findByProject(projectId);
  const target = chapterIds
    ? chapters.filter(c => chapterIds.includes(c.id))
    : chapters;

  const parts: string[] = [];
  let total = 0;

  for (const ch of target) {
    if (total >= maxChars) break;
    try {
      const raw = await readChapter(projectId, ch.id);
      const plain = stripHtml(raw);
      if (plain.length > 0) {
        const remaining = maxChars - total;
        const content = plain.length > remaining ? plain.slice(0, remaining) + '...' : plain;
        parts.push(`【${ch.title}】\n${content}`);
        total += content.length;
      }
    } catch { /* skip */ }
  }

  return parts.join('\n\n');
}

export async function extractRelationships(
  projectId: string,
  chapterIds?: string[],
): Promise<ExtractionResult> {
  const characters = characterRepo.findByProject(projectId);
  if (characters.length === 0) {
    return { relations: [], factions: [], chaptersProcessed: 0 };
  }

  const charList = characters.map(c =>
    `${c.name}（${c.role_type}${c.nickname ? `，别名：${c.nickname}` : ''}）`,
  ).join('、');

  const content = await gatherContent(projectId, chapterIds);
  if (!content.trim()) {
    return { relations: [], factions: [], chaptersProcessed: 0 };
  }

  const skill = getSkill('extract-relationships');
  const systemPrompt = skill?.systemPrompt || '请分析角色关系并以JSON格式输出。';

  const userMessage = `已知角色列表：${charList}\n\n以下是小说章节内容：\n\n${content}\n\n请提取所有角色关系和阵营归属，严格按JSON格式输出。`;

  const response = await completeChat(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    { temperature: 0.3, maxTokens: 4000 },
  );

  const parsed = parseJsonResponse(response);
  if (!parsed) {
    return { relations: [], factions: [], chaptersProcessed: 0 };
  }

  const chaptersProcessed = chapterIds
    ? chapterIds.length
    : chapterRepo.findByProject(projectId).length;

  return {
    relations: Array.isArray(parsed.relations) ? parsed.relations.filter(validateRelation) : [],
    factions: Array.isArray(parsed.factions) ? parsed.factions : [],
    chaptersProcessed,
  };
}

function validateRelation(r: unknown): r is ExtractedRelation {
  if (typeof r !== 'object' || r === null) return false;
  const obj = r as Record<string, unknown>;
  return typeof obj.characterA === 'string'
    && typeof obj.characterB === 'string'
    && typeof obj.relationType === 'string';
}

function parseJsonResponse(text: string): { relations?: unknown[]; factions?: unknown[] } | null {
  // Try to find JSON in the response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  try {
    return JSON.parse(jsonMatch[0]);
  } catch {
    // Try fixing common issues
    try {
      const fixed = jsonMatch[0]
        .replace(/,\s*([}\]])/g, '$1')
        .replace(/'/g, '"');
      return JSON.parse(fixed);
    } catch {
      logger.warn('Failed to parse AI relationship extraction response');
      return null;
    }
  }
}
