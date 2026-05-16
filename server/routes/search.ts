import { Router, type Request } from 'express';
import * as chapterRepo from '../db/repositories/chapterRepo.js';
import { readChapter } from '../services/fileService.js';

type SearchParams = { projectId: string };

const router = Router({ mergeParams: true });

router.post('/', async (req: Request<SearchParams>, res) => {
  const { projectId } = req.params;
  const { query } = req.body as { query?: string };

  if (!query || query.length < 2) {
    res.status(400).json({ success: false, error: '搜索词至少 2 个字符' });
    return;
  }

  const chapters = chapterRepo.findByProject(projectId);
  const results: Array<{
    chapterId: string;
    chapterTitle: string;
    snippet: string;
    matchStart: number;
  }> = [];

  const lowerQuery = query.toLowerCase();
  const CONTEXT = 30;
  const MAX_RESULTS = 50;

  for (const ch of chapters) {
    if (results.length >= MAX_RESULTS) break;

    let content: string;
    try {
      content = await readChapter(ch.project_id, ch.id);
    } catch {
      continue;
    }

    const plain = content.replace(/<[^>]+>/g, '').replace(/&[^;]+;/g, ' ');
    const lower = plain.toLowerCase();
    let searchFrom = 0;

    while (searchFrom < lower.length && results.length < MAX_RESULTS) {
      const idx = lower.indexOf(lowerQuery, searchFrom);
      if (idx === -1) break;

      const snippetStart = Math.max(0, idx - CONTEXT);
      const snippetEnd = Math.min(plain.length, idx + lowerQuery.length + CONTEXT);
      let snippet = plain.slice(snippetStart, snippetEnd);
      if (snippetStart > 0) snippet = '...' + snippet;
      if (snippetEnd < plain.length) snippet += '...';

      results.push({
        chapterId: ch.id,
        chapterTitle: ch.title,
        snippet,
        matchStart: idx,
      });

      searchFrom = idx + lowerQuery.length;
    }
  }

  res.json({ success: true, data: results });
});

export default router;