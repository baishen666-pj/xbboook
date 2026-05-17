import * as chapterRepo from '../db/repositories/chapterRepo.js';
import * as searchCacheRepo from '../db/repositories/searchCacheRepo.js';
import { readChapter } from './fileService.js';
import { logger } from '../middleware/logger.js';

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&[^;]+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function indexChapter(projectId: string, chapterId: string, content?: string): Promise<void> {
  const text = content ?? await readChapter(projectId, chapterId);
  const plainText = stripHtml(text);
  searchCacheRepo.upsert(chapterId, projectId, plainText);
}

export async function indexProject(projectId: string): Promise<{ indexed: number; errors: number }> {
  const chapters = chapterRepo.findByProject(projectId);
  let indexed = 0;
  let errors = 0;

  for (const ch of chapters) {
    try {
      await indexChapter(ch.project_id, ch.id);
      indexed++;
    } catch {
      errors++;
    }
  }

  logger.info({ projectId, indexed, errors, total: chapters.length }, 'search index rebuilt');
  return { indexed, errors };
}

export function removeChapterIndex(chapterId: string): void {
  searchCacheRepo.removeByChapter(chapterId);
}

export function removeProjectIndex(projectId: string): void {
  searchCacheRepo.removeByProject(projectId);
}
