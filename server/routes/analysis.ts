import { Router, type Request } from 'express';
import { runAnalysis, quickAnalysis } from '../services/analysisService.js';
import * as chapterRepo from '../db/repositories/chapterRepo.js';
import { isConfigured } from '../services/aiService.js';

type ProjectParams = { projectId: string };

const router = Router({ mergeParams: true });

// Run deep analysis
router.post('/', async (req: Request<ProjectParams>, res) => {
  const { projectId } = req.params;
  const { analysisType, chapterIds, characterId } = req.body as {
    analysisType: string;
    chapterIds?: string[];
    characterId?: string;
  };

  if (!analysisType) {
    res.status(400).json({ success: false, error: 'analysisType 必填' });
    return;
  }

  const validTypes = ['story-analysis', 'pacing-analysis', 'emotion-arc', 'character-arc', 'outline-generate', 'reader-simulate'];
  if (!validTypes.includes(analysisType)) {
    res.status(400).json({ success: false, error: `不支持的分析类型: ${analysisType}` });
    return;
  }

  if (!isConfigured()) {
    res.status(400).json({ success: false, error: 'AI 未配置' });
    return;
  }

  try {
    const result = await runAnalysis({
      projectId,
      analysisType,
      chapterIds,
      characterId,
    });
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : '分析失败',
    });
  }
});

// Quick stats (no AI needed)
router.get('/quick', async (req: Request<ProjectParams>, res) => {
  const { projectId } = req.params;
  const chapters = chapterRepo.findByProject(projectId);
  const totalWords = chapters.reduce((sum, c) => sum + (c.word_count || 0), 0);
  const avgWords = chapters.length > 0 ? Math.round(totalWords / chapters.length) : 0;
  const published = chapters.filter(c => c.publish_status === 'published').length;
  const volumes = new Set(chapters.map(c => c.volume_id).filter(Boolean)).size;

  res.json({
    success: true,
    data: {
      totalChapters: chapters.length,
      totalWords,
      avgWordsPerChapter: avgWords,
      publishedChapters: published,
      volumeCount: volumes,
      chapters: chapters.map(c => ({
        id: c.id,
        title: c.title,
        wordCount: c.word_count,
        status: c.publish_status,
        volumeId: c.volume_id,
      })),
    },
  });
});

// Get available analysis types
router.get('/types', (_req, res) => {
  res.json({
    success: true,
    data: [
      { id: 'story-analysis', name: '故事结构分析', icon: '📐', description: '分析故事的三幕结构、转折点和高潮' },
      { id: 'pacing-analysis', name: '节奏分析', icon: '📊', description: '分析写作节奏，检测拖沓和过快段落' },
      { id: 'emotion-arc', name: '情感曲线', icon: '📈', description: '追踪情感走向，生成情感强度曲线' },
      { id: 'character-arc', name: '角色弧线', icon: '🎭', description: '分析角色成长轨迹和变化' },
      { id: 'outline-generate', name: '大纲生成', icon: '🗺️', description: '从已有章节反向生成结构化大纲' },
    ],
  });
});

export default router;
