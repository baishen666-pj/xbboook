import { getDb } from '../database.js';

export function getPlainText(chapterId: string): string | null {
  const db = getDb();
  const row = db.prepare('SELECT plain_text FROM chapter_search_cache WHERE chapter_id = ?').get(chapterId) as { plain_text: string } | undefined;
  return row?.plain_text ?? null;
}

export function upsert(chapterId: string, projectId: string, plainText: string): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO chapter_search_cache (chapter_id, project_id, plain_text, updated_at)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(chapter_id) DO UPDATE SET plain_text = excluded.plain_text, updated_at = datetime('now')
  `).run(chapterId, projectId, plainText);
}

export function removeByChapter(chapterId: string): void {
  const db = getDb();
  db.prepare('DELETE FROM chapter_search_cache WHERE chapter_id = ?').run(chapterId);
}

export function removeByProject(projectId: string): void {
  const db = getDb();
  db.prepare('DELETE FROM chapter_search_cache WHERE project_id = ?').run(projectId);
}

export function searchPlainText(projectId: string, query: string, options?: {
  volumeId?: string;
  limit?: number;
}): Array<{ chapter_id: string; snippet: string; match_index: number }> {
  const db = getDb();
  const limit = options?.limit ?? 20;
  const escapedQuery = query.replace(/[%_\\]/g, '\\$&');
  const likePattern = `%${escapedQuery}%`;

  let sql: string;
  let params: unknown[];

  if (options?.volumeId) {
    sql = `
      SELECT csc.chapter_id, csc.plain_text
      FROM chapter_search_cache csc
      JOIN chapters c ON c.id = csc.chapter_id
      WHERE csc.project_id = ? AND c.volume_id = ? AND csc.plain_text LIKE ? ESCAPE '\\'
      ORDER BY c.sort_order ASC
      LIMIT ?
    `;
    params = [projectId, options.volumeId, likePattern, limit];
  } else {
    sql = `
      SELECT csc.chapter_id, csc.plain_text
      FROM chapter_search_cache csc
      JOIN chapters c ON c.id = csc.chapter_id
      WHERE csc.project_id = ? AND csc.plain_text LIKE ? ESCAPE '\\'
      ORDER BY c.sort_order ASC
      LIMIT ?
    `;
    params = [projectId, likePattern, limit];
  }

  const rows = db.prepare(sql).all(...params) as Array<{ chapter_id: string; plain_text: string }>;

  const CONTEXT = 40;
  return rows.map((row) => {
    const lower = row.plain_text.toLowerCase();
    const idx = lower.indexOf(query.toLowerCase());
    const snippetStart = Math.max(0, idx - CONTEXT);
    const snippetEnd = Math.min(row.plain_text.length, idx + query.length + CONTEXT);
    let snippet = row.plain_text.slice(snippetStart, snippetEnd);
    if (snippetStart > 0) snippet = '...' + snippet;
    if (snippetEnd < row.plain_text.length) snippet += '...';

    return {
      chapter_id: row.chapter_id,
      snippet: escapeHtml(snippet),
      match_index: idx,
    };
  });
}

export function getStats(projectId: string): { cached_chapters: number; total_chapters: number } {
  const db = getDb();
  const cached = db.prepare('SELECT COUNT(*) as count FROM chapter_search_cache WHERE project_id = ?').get(projectId) as { count: number };
  const total = db.prepare('SELECT COUNT(*) as count FROM chapters WHERE project_id = ?').get(projectId) as { count: number };
  return { cached_chapters: cached.count, total_chapters: total.count };
}

function escapeHtml(s: string): string {
  return s.replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c] ?? c));
}
