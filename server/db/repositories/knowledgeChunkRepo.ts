import { v4 as uuid } from 'uuid';
import { getDb } from '../database.js';

export interface KnowledgeChunk {
  id: string;
  project_id: string;
  source_type: string;
  source_id: string;
  chunk_text: string;
  chunk_index: number;
  token_count: number;
  created_at: string;
  updated_at: string;
}

const CHUNK_SIZE = 800;
const CHUNK_OVERLAP = 100;

function splitIntoChunks(text: string, size = CHUNK_SIZE, overlap = CHUNK_OVERLAP): string[] {
  if (text.length <= size) return [text];

  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = start + size;
    if (end < text.length) {
      const lastPeriod = text.lastIndexOf('。', end);
      const lastNewline = text.lastIndexOf('\n', end);
      const breakPoint = Math.max(lastPeriod, lastNewline);
      if (breakPoint > start) end = breakPoint + 1;
    }
    chunks.push(text.slice(start, end));
    start = end - overlap;
    if (start <= chunks.length > 1 ? 0 : -overlap) start = end;
  }
  return chunks;
}

export function estimateTokens(text: string): number {
  if (!text) return 0;
  const cjkCount = (text.match(/[一-鿿㐀-䶿]/g) || []).length;
  const cjkRatio = cjkCount / text.length;
  const effectiveCharsPerToken = cjkRatio * 1.5 + (1 - cjkRatio) * 4.0;
  return Math.ceil(text.length / effectiveCharsPerToken);
}

export function findBySource(projectId: string, sourceType: string, sourceId: string): KnowledgeChunk[] {
  const db = getDb();
  return db.prepare(
    'SELECT * FROM knowledge_chunks WHERE project_id = ? AND source_type = ? AND source_id = ? ORDER BY chunk_index ASC',
  ).all(projectId, sourceType, sourceId) as KnowledgeChunk[];
}

export function search(projectId: string, query: string, limit = 10): Array<KnowledgeChunk & { relevance: number }> {
  const db = getDb();
  const escapedQuery = query.replace(/[%_\\]/g, '\\$&');
  const likePattern = `%${escapedQuery}%`;

  const rows = db.prepare(`
    SELECT *, (
      (CASE WHEN chunk_text LIKE ? ESCAPE '\\' THEN 1 ELSE 0 END) +
      (CASE WHEN chunk_text LIKE ? ESCAPE '\\' THEN 2 ELSE 0 END)
    ) as relevance
    FROM knowledge_chunks
    WHERE project_id = ? AND chunk_text LIKE ? ESCAPE '\\'
    ORDER BY relevance DESC, chunk_index ASC
    LIMIT ?
  `).all(
    `%${escapedQuery.substring(0, Math.min(4, escapedQuery.length))}%`,
    likePattern,
    projectId,
    likePattern,
    limit,
  ) as Array<KnowledgeChunk & { relevance: number }>;

  return rows;
}

export function indexContent(
  projectId: string,
  sourceType: string,
  sourceId: string,
  text: string,
): KnowledgeChunk[] {
  const db = getDb();

  db.prepare(
    'DELETE FROM knowledge_chunks WHERE project_id = ? AND source_type = ? AND source_id = ?',
  ).run(projectId, sourceType, sourceId);

  const chunks = splitIntoChunks(text);
  const stmt = db.prepare(`
    INSERT INTO knowledge_chunks (id, project_id, source_type, source_id, chunk_text, chunk_index, token_count, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `);

  const results: KnowledgeChunk[] = [];
  const now = new Date().toISOString();

  const tx = db.transaction(() => {
    for (let i = 0; i < chunks.length; i++) {
      const id = uuid();
      const tokenCount = estimateTokens(chunks[i]);
      stmt.run(id, projectId, sourceType, sourceId, chunks[i], i, tokenCount);
      results.push({
        id,
        project_id: projectId,
        source_type: sourceType,
        source_id: sourceId,
        chunk_text: chunks[i],
        chunk_index: i,
        token_count: tokenCount,
        created_at: now,
        updated_at: now,
      });
    }
  });
  tx();

  return results;
}

export function deleteBySource(projectId: string, sourceType: string, sourceId: string): number {
  const db = getDb();
  const result = db.prepare(
    'DELETE FROM knowledge_chunks WHERE project_id = ? AND source_type = ? AND source_id = ?',
  ).run(projectId, sourceType, sourceId);
  return result.changes;
}

export function deleteByProject(projectId: string): number {
  const db = getDb();
  const result = db.prepare('DELETE FROM knowledge_chunks WHERE project_id = ?').run(projectId);
  return result.changes;
}

export function countByProject(projectId: string): number {
  const db = getDb();
  const row = db.prepare('SELECT COUNT(*) as cnt FROM knowledge_chunks WHERE project_id = ?').get(projectId) as { cnt: number };
  return row.cnt;
}

export function rebuildProjectIndex(projectId: string): { indexed: number; total: number } {
  deleteByProject(projectId);
  return { indexed: 0, total: 0 };
}
