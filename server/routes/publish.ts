import { Router, type Request } from 'express';
import * as publishTargetRepo from '../db/repositories/publishTargetRepo.js';
import * as exportTemplateRepo from '../db/repositories/exportTemplateRepo.js';
import { findByProject as findChapters } from '../db/repositories/chapterRepo.js';

type ProjectParams = { projectId: string };

const router = Router({ mergeParams: true });

const PLATFORM_LABELS: Record<string, string> = {
  wechat: '微信公众号',
  zhihu: '知乎',
  jianshu: '简书',
  csdn: 'CSDN',
  custom: '自定义',
};

// List publish targets
router.get('/', (req: Request<ProjectParams>, res) => {
  const { projectId } = req.params;
  const targets = publishTargetRepo.findByProject(projectId);
  res.json({
    success: true,
    data: targets.map(t => ({
      ...t,
      platformLabel: PLATFORM_LABELS[t.platform] || t.platform,
    })),
  });
});

// Get available platforms
router.get('/platforms', (_req, res) => {
  res.json({
    success: true,
    data: Object.entries(PLATFORM_LABELS).map(([value, label]) => ({ value, label })),
  });
});

// Create publish target
router.post('/', (req: Request<ProjectParams>, res) => {
  const { projectId } = req.params;
  const { name, platform, config } = req.body as {
    name: string;
    platform: string;
    config?: string;
  };

  if (!name || !platform) {
    res.status(400).json({ success: false, error: 'name, platform 必填' });
    return;
  }

  const target = publishTargetRepo.create({
    projectId,
    name,
    platform,
    config: config || '{}',
  });

  res.status(201).json({ success: true, data: target });
});

// Update publish target
router.patch('/:targetId', (req: Request<ProjectParams & { targetId: string }>, res) => {
  const { targetId } = req.params;
  const data = req.body as Partial<{ name: string; platform: string; config: string }>;

  const updated = publishTargetRepo.update(targetId, data);
  if (!updated) {
    res.status(404).json({ success: false, error: '发布目标不存在' });
    return;
  }

  res.json({ success: true, data: updated });
});

// Delete publish target
router.delete('/:targetId', (req: Request<ProjectParams & { targetId: string }>, res) => {
  const { targetId } = req.params;
  const deleted = publishTargetRepo.deleteById(targetId);
  if (!deleted) {
    res.status(404).json({ success: false, error: '发布目标不存在' });
    return;
  }
  res.json({ success: true, data: null });
});

// Export for a specific platform
router.post('/:targetId/export', async (req: Request<ProjectParams & { targetId: string }>, res) => {
  const { projectId, targetId } = req.params;
  const { chapterIds } = req.body as { chapterIds?: string[] };

  const target = publishTargetRepo.findById(targetId);
  if (!target || target.project_id !== projectId) {
    res.status(404).json({ success: false, error: '发布目标不存在' });
    return;
  }

  const chapters = findChapters(projectId);
  const selected = chapterIds
    ? chapters.filter(c => chapterIds.includes(c.id))
    : chapters;

  const template = exportTemplateRepo.findByPlatform(target.platform)[0];

  const exportData = {
    targetId: target.id,
    platform: target.platform,
    platformLabel: PLATFORM_LABELS[target.platform] || target.platform,
    chapterCount: selected.length,
    totalWords: selected.reduce((sum, c) => sum + (c.word_count || 0), 0),
    templateAvailable: !!template,
    exportUrl: `/api/projects/${projectId}/export/${target.platform === 'wechat' ? 'wechat' : 'html'}${template ? `?template=${template.id}` : ''}${chapterIds?.length ? `&chapters=${chapterIds.join(',')}` : ''}`,
  };

  publishTargetRepo.updateLastPublished(targetId);

  res.json({ success: true, data: exportData });
});

export default router;
