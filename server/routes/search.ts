import { Router, type Request } from 'express';
import { getDb } from '../db/database.js';
import * as searchCacheRepo from '../db/repositories/searchCacheRepo.js';
import * as chapterRepo from '../db/repositories/chapterRepo.js';
import { indexProject } from '../services/searchIndexer.js';
import { readChapter } from '../services/fileService.js';

type SearchParams = { projectId: string };

interface ChapterSearchResult {
  category: 'chapters';
  chapterId: string;
  chapterTitle: string;
  volumeId: string | null;
  snippet: string;
  highlights: string[];
  matchStart: number;
}

interface MetadataSearchResult {
  category: 'characters' | 'worldviews' | 'outlines' | 'foreshadowing';
  id: string;
  title: string;
  snippet: string;
  highlights: string[];
}

type SearchResult = ChapterSearchResult | MetadataSearchResult;

interface Suggestion {
  text: string;
  category: 'chapter' | 'character' | 'worldview' | 'outline' | 'foreshadowing';
  id: string;
}

const router = Router({ mergeParams: true });

function escapeLike(s: string): string {
  return s.replace(/[%_\\]/g, '\\$&');
}

function escapeHtml(s: string): string {
  return s.replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c] ?? c));
}

function extractSnippet(text: string, query: string, context = 40): { snippet: string; highlights: string[] } {
  const lower = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const idx = lower.indexOf(lowerQuery);
  if (idx === -1) return { snippet: escapeHtml(text.slice(0, context * 2)), highlights: [] };

  const start = Math.max(0, idx - context);
  const end = Math.min(text.length, idx + lowerQuery.length + context);
  let snippet = text.slice(start, end);
  if (start > 0) snippet = '...' + snippet;
  if (end < text.length) snippet += '...';

  const highlights: string[] = [];
  const plainSnippet = snippet.replace(/\.\.\./g, '');
  let searchFrom = 0;
  while (searchFrom < plainSnippet.length) {
    const matchIdx = plainSnippet.toLowerCase().indexOf(lowerQuery, searchFrom);
    if (matchIdx === -1) break;
    highlights.push(plainSnippet.slice(matchIdx, matchIdx + lowerQuery.length));
    searchFrom = matchIdx + 1;
  }

  return { snippet: escapeHtml(snippet), highlights };
}

router.post('/', async (req: Request<SearchParams>, res) => {
  const { projectId } = req.params;
  const body = req.body as {
    query?: string;
    categories?: string[];
    volumeId?: string;
    limit?: number;
  };

  if (!body.query || body.query.length < 2) {
    res.status(400).json({ success: false, error: '搜索词至少 2 个字符' });
    return;
  }

  const { query, categories, volumeId, limit = 50 } = body;
  const results: SearchResult[] = [];
  const wantChapters = !categories || categories.includes('chapters');
  const wantCharacters = !categories || categories.includes('characters');
  const wantWorldviews = !categories || categories.includes('worldviews');
  const wantOutlines = !categories || categories.includes('outlines');
  const wantForeshadowing = !categories || categories.includes('foreshadowing');

  if (wantChapters) {
    const cached = searchCacheRepo.searchPlainText(projectId, query, { volumeId, limit });
    for (const hit of cached) {
      const ch = chapterRepo.findById(hit.chapter_id);
      if (!ch) continue;
      results.push({
        category: 'chapters',
        chapterId: ch.id,
        chapterTitle: ch.title,
        volumeId: ch.volume_id,
        snippet: hit.snippet,
        highlights: query.length >= 2 ? [query] : [],
        matchStart: hit.match_index,
      });
    }

    if (cached.length === 0) {
      const chapters = chapterRepo.findByProject(projectId);
      const escapedQuery = escapeLike(query);
      const likePattern = `%${escapedQuery}%`;
      let count = 0;
      for (const ch of chapters) {
        if (count >= limit) break;
        if (volumeId && ch.volume_id !== volumeId) continue;

        if (ch.title.toLowerCase().includes(query.toLowerCase())) {
          results.push({
            category: 'chapters',
            chapterId: ch.id,
            chapterTitle: ch.title,
            volumeId: ch.volume_id,
            snippet: '',
            highlights: [query],
            matchStart: 0,
          });
          count++;
          continue;
        }

        try {
          const content = await readChapter(ch.project_id, ch.id);
          const plain = content.replace(/<[^>]+>/g, '').replace(/&[^;]+;/g, ' ');
          const lower = plain.toLowerCase();
          const idx = lower.indexOf(query.toLowerCase());
          if (idx === -1) continue;

          const { snippet, highlights } = extractSnippet(plain, query);
          results.push({
            category: 'chapters',
            chapterId: ch.id,
            chapterTitle: ch.title,
            volumeId: ch.volume_id,
            snippet,
            highlights,
            matchStart: idx,
          });
          count++;
        } catch {
          // skip unreadable chapters
        }
      }
    }
  }

  const db = getDb();
  const metadataSearches: Array<{
    category: MetadataSearchResult['category'];
    table: string;
    titleCol: string;
    contentCol: string;
    enabled: boolean;
  }> = [
    { category: 'characters', table: 'characters', titleCol: 'name', contentCol: 'personality', enabled: wantCharacters },
    { category: 'worldviews', table: 'worldviews', titleCol: 'title', contentCol: 'content', enabled: wantWorldviews },
    { category: 'outlines', table: 'outlines', titleCol: 'title', contentCol: 'content', enabled: wantOutlines },
    { category: 'foreshadowing', table: 'foreshadowing', titleCol: 'title', contentCol: 'description', enabled: wantForeshadowing },
  ];

  for (const ms of metadataSearches) {
    if (!ms.enabled) continue;
    const escapedQuery = escapeLike(query);
    const likePattern = `%${escapedQuery}%`;
    const rows = db.prepare(
      `SELECT id, ${ms.titleCol} as title, ${ms.contentCol} as content
       FROM ${ms.table}
       WHERE project_id = ? AND (${ms.titleCol} LIKE ? ESCAPE '\\' OR ${ms.contentCol} LIKE ? ESCAPE '\\')
       ORDER BY sort_order ASC
       LIMIT ?`,
    ).all(projectId, likePattern, likePattern, limit) as Array<{ id: string; title: string; content: string }>;

    for (const row of rows) {
      const { snippet, highlights } = extractSnippet(row.content || '', query);
      results.push({
        category: ms.category,
        id: row.id,
        title: row.title,
        snippet,
        highlights,
      });
    }
  }

  res.json({ success: true, data: results });
});

router.get('/suggest', (req: Request<SearchParams>, res) => {
  const { projectId } = req.params;
  const q = req.query.q as string;
  if (!q || q.length < 1) {
    res.json({ success: true, data: [] });
    return;
  }

  const db = getDb();
  const suggestions: Suggestion[] = [];
  const escapedQuery = escapeLike(q);
  const likePattern = `${escapedQuery}%`;
  const MAX = 8;

  const chapters = db.prepare(
    "SELECT id, title FROM chapters WHERE project_id = ? AND title LIKE ? ESCAPE '\\' LIMIT ?",
  ).all(projectId, likePattern, MAX) as Array<{ id: string; title: string }>;

  for (const ch of chapters) {
    suggestions.push({ text: ch.title, category: 'chapter', id: ch.id });
  }

  const remaining = MAX - suggestions.length;
  if (remaining > 0) {
    const chars = db.prepare(
      "SELECT id, name as title FROM characters WHERE project_id = ? AND name LIKE ? ESCAPE '\\' LIMIT ?",
    ).all(projectId, likePattern, remaining) as Array<{ id: string; title: string }>;

    for (const c of chars) {
      suggestions.push({ text: c.title, category: 'character', id: c.id });
    }
  }

  const remaining2 = MAX - suggestions.length;
  if (remaining2 > 0) {
    const worldviews = db.prepare(
      "SELECT id, title FROM worldviews WHERE project_id = ? AND title LIKE ? ESCAPE '\\' LIMIT ?",
    ).all(projectId, likePattern, remaining2) as Array<{ id: string; title: string }>;

    for (const w of worldviews) {
      suggestions.push({ text: w.title, category: 'worldview', id: w.id });
    }
  }

  res.json({ success: true, data: suggestions });
});

router.post('/reindex', async (req: Request<SearchParams>, res) => {
  const { projectId } = req.params;
  const result = await indexProject(projectId);
  res.json({ success: true, data: result });
});

router.get('/stats', (req: Request<SearchParams>, res) => {
  const { projectId } = req.params;
  const stats = searchCacheRepo.getStats(projectId);
  res.json({ success: true, data: stats });
});

export default router;
