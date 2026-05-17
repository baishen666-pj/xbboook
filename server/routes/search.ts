import { Router, type Request } from 'express';
import { getDb } from '../db/database.js';
import * as chapterRepo from '../db/repositories/chapterRepo.js';
import { readChapter } from '../services/fileService.js';

type SearchParams = { projectId: string };

interface ChapterSearchResult {
  category: 'chapters';
  chapterId: string;
  chapterTitle: string;
  snippet: string;
  matchStart: number;
}

interface MetadataSearchResult {
  category: 'characters' | 'worldviews' | 'outlines' | 'foreshadowing';
  id: string;
  title: string;
  snippet: string;
}

type SearchResult = ChapterSearchResult | MetadataSearchResult;

const router = Router({ mergeParams: true });

router.post('/', async (req: Request<SearchParams>, res) => {
  const { projectId } = req.params;
  const { query } = req.body as { query?: string };

  if (!query || query.length < 2) {
    res.status(400).json({ success: false, error: '搜索词至少 2 个字符' });
    return;
  }

  const lowerQuery = query.toLowerCase();
  const CONTEXT = 30;
  const MAX_PER_CATEGORY = 10;

  const results: SearchResult[] = [];

  // 1. Search chapters (content)
  const chapters = chapterRepo.findByProject(projectId);
  const chapterContents = await Promise.all(
    chapters.map(async (ch) => {
      try {
        const content = await readChapter(ch.project_id, ch.id);
        return { ch, content };
      } catch {
        return null;
      }
    }),
  );

  let chapterCount = 0;
  for (const entry of chapterContents) {
    if (chapterCount >= MAX_PER_CATEGORY) break;
    if (!entry) continue;

    const { ch, content } = entry;
    const plain = content.replace(/<[^>]+>/g, '').replace(/&[^;]+;/g, ' ');
    const lower = plain.toLowerCase();
    const idx = lower.indexOf(lowerQuery);
    if (idx === -1) continue;

    const snippetStart = Math.max(0, idx - CONTEXT);
    const snippetEnd = Math.min(plain.length, idx + lowerQuery.length + CONTEXT);
    let snippet = plain.slice(snippetStart, snippetEnd);
    if (snippetStart > 0) snippet = '...' + snippet;
    if (snippetEnd < plain.length) snippet += '...';

    results.push({
      category: 'chapters',
      chapterId: ch.id,
      chapterTitle: ch.title,
      snippet: snippet.replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c] ?? c)),
      matchStart: idx,
    });
    chapterCount++;
  }

  // 2. Search metadata tables
  const db = getDb();
  const metadataSearches: Array<{
    category: MetadataSearchResult['category'];
    table: string;
    titleCol: string;
    contentCol: string;
  }> = [
    { category: 'characters', table: 'characters', titleCol: 'name', contentCol: 'personality' },
    { category: 'worldviews', table: 'worldviews', titleCol: 'title', contentCol: 'content' },
    { category: 'outlines', table: 'outlines', titleCol: 'title', contentCol: 'content' },
    { category: 'foreshadowing', table: 'foreshadowing', titleCol: 'title', contentCol: 'description' },
  ];

  for (const ms of metadataSearches) {
    const rows = db.prepare(
      `SELECT id, ${ms.titleCol} as title, ${ms.contentCol} as content FROM ${ms.table} WHERE project_id = ?`
    ).all(projectId) as Array<{ id: string; title: string; content: string }>;

    let count = 0;
    for (const row of rows) {
      if (count >= MAX_PER_CATEGORY) break;
      const titleMatch = row.title.toLowerCase().includes(lowerQuery);
      const contentMatch = row.content.toLowerCase().includes(lowerQuery);
      if (!titleMatch && !contentMatch) continue;

      let snippet = '';
      if (contentMatch) {
        const lower = row.content.toLowerCase();
        const idx = lower.indexOf(lowerQuery);
        const start = Math.max(0, idx - CONTEXT);
        const end = Math.min(row.content.length, idx + lowerQuery.length + CONTEXT);
        snippet = row.content.slice(start, end);
        if (start > 0) snippet = '...' + snippet;
        if (end < row.content.length) snippet += '...';
      } else {
        snippet = row.content.slice(0, CONTEXT * 2) + (row.content.length > CONTEXT * 2 ? '...' : '');
      }

      results.push({
        category: ms.category,
        id: row.id,
        title: row.title,
        snippet,
      });
      count++;
    }
  }

  res.json({ success: true, data: results });
});

export default router;