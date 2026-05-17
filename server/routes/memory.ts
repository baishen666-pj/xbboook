import { Router, type Request } from 'express';
import { getDb } from '../db/database.js';
import * as memoryRepo from '../db/repositories/memoryRepo.js';
import * as knowledgeChunkRepo from '../db/repositories/knowledgeChunkRepo.js';
import { retrieve, indexProjectKnowledge } from '../ai/ragRetriever.js';
import { extractAndStore } from '../ai/memoryExtractor.js';
import { readChapter } from '../services/fileService.js';
import * as chapterRepo from '../db/repositories/chapterRepo.js';

type ProjectParams = { projectId: string };

const router = Router({ mergeParams: true });

// List memories
router.get('/', (req: Request<ProjectParams>, res) => {
  const { projectId } = req.params;
  const category = req.query.category as string | undefined;
  const importance = req.query.importance as string | undefined;

  const memories = memoryRepo.findByProject(projectId, { category, importance });
  res.json({ success: true, data: memories });
});

// Get memory stats
router.get('/stats', (req: Request<ProjectParams>, res) => {
  const { projectId } = req.params;
  const totalMemories = memoryRepo.countByProject(projectId);
  const totalChunks = knowledgeChunkRepo.countByProject(projectId);

  const db = getDb();
  const byCategory = db.prepare(
    'SELECT category, COUNT(*) as count FROM ai_memory_entries WHERE project_id = ? GROUP BY category',
  ).all(projectId) as Array<{ category: string; count: number }>;

  const byImportance = db.prepare(
    'SELECT importance, COUNT(*) as count FROM ai_memory_entries WHERE project_id = ? GROUP BY importance',
  ).all(projectId) as Array<{ importance: string; count: number }>;

  res.json({
    success: true,
    data: {
      totalMemories,
      totalChunks,
      byCategory: Object.fromEntries(byCategory.map(r => [r.category, r.count])),
      byImportance: Object.fromEntries(byImportance.map(r => [r.importance, r.count])),
    },
  });
});

// RAG search
router.post('/search', (req: Request<ProjectParams>, res) => {
  const { projectId } = req.params;
  const { query, maxTokens, maxResults, includeMemory } = req.body as {
    query?: string;
    maxTokens?: number;
    maxResults?: number;
    includeMemory?: boolean;
  };

  if (!query || query.length < 2) {
    res.status(400).json({ success: false, error: '搜索词至少 2 个字符' });
    return;
  }

  const results = retrieve(projectId, query, { maxTokens, maxResults, includeMemory });
  res.json({ success: true, data: results });
});

// Create memory
router.post('/', (req: Request<ProjectParams>, res) => {
  const { projectId } = req.params;
  const { chapterId, category, title, content, importance, chapterIndex } = req.body as {
    chapterId?: string;
    category: string;
    title: string;
    content: string;
    importance?: string;
    chapterIndex?: number;
  };

  if (!category || !title || !content) {
    res.status(400).json({ success: false, error: 'category, title, content 必填' });
    return;
  }

  const memory = memoryRepo.create({
    projectId,
    chapterId,
    category,
    title,
    content,
    importance,
    chapterIndex,
    isAutoExtracted: false,
  });

  res.status(201).json({ success: true, data: memory });
});

// Update memory
router.patch('/:memoryId', (req: Request<ProjectParams & { memoryId: string }>, res) => {
  const { memoryId } = req.params;
  const data = req.body as Partial<{
    chapter_id: string | null;
    category: string;
    title: string;
    content: string;
    importance: string;
    chapter_index: number | null;
  }>;

  const updated = memoryRepo.update(memoryId, data);
  if (!updated) {
    res.status(404).json({ success: false, error: '记忆不存在' });
    return;
  }

  res.json({ success: true, data: updated });
});

// Delete memory
router.delete('/:memoryId', (req: Request<ProjectParams & { memoryId: string }>, res) => {
  const { memoryId } = req.params;
  const deleted = memoryRepo.deleteById(memoryId);
  if (!deleted) {
    res.status(404).json({ success: false, error: '记忆不存在' });
    return;
  }
  res.json({ success: true, data: null });
});

// Batch extract memories from a chapter
router.post('/extract/:chapterId', async (req: Request<ProjectParams & { chapterId: string }>, res) => {
  const { projectId, chapterId } = req.params;
  const chapter = chapterRepo.findById(chapterId);
  if (!chapter) {
    res.status(404).json({ success: false, error: '章节不存在' });
    return;
  }

  try {
    const content = await readChapter(projectId, chapterId);
    if (!content) {
      res.status(400).json({ success: false, error: '章节内容为空' });
      return;
    }

    const chapters = chapterRepo.findByProject(projectId);
    const chapterIndex = chapters.findIndex(c => c.id === chapterId);
    const count = await extractAndStore(projectId, chapterId, chapter.title, content, chapterIndex >= 0 ? chapterIndex : undefined);

    res.json({ success: true, data: { extracted: count } });
  } catch (err) {
    res.status(500).json({ success: false, error: '记忆提取失败' });
  }
});

// Rebuild knowledge index
router.post('/reindex', async (req: Request<ProjectParams>, res) => {
  const { projectId } = req.params;
  try {
    const result = await indexProjectKnowledge(projectId);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: '知识索引重建失败' });
  }
});

// Clear auto-extracted memories
router.post('/clear-auto', (req: Request<ProjectParams>, res) => {
  const { projectId } = req.params;
  const deleted = memoryRepo.deleteAutoExtracted(projectId);
  res.json({ success: true, data: { deleted } });
});

export default router;
