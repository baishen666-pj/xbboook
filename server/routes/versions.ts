import { Router, type Request } from 'express';
import { z } from 'zod';
import * as versionService from '../services/versionService.js';
import { validate } from '../middleware/validate.js';

type VersionParams = { projectId: string; chapterId: string; versionId: string };

const router = Router({ mergeParams: true });

const createSchema = z.object({
  label: z.string().max(50).optional(),
});

const pruneSchema = z.object({
  keepCount: z.number().int().min(1).max(100).default(20),
});

router.get('/', async (req: Request<VersionParams>, res) => {
  const { chapterId } = req.params;
  const versions = await versionService.listVersions(chapterId);
  res.json({ success: true, data: versions });
});

router.get('/:versionId', async (req: Request<VersionParams>, res) => {
  const { projectId, chapterId, versionId } = req.params;
  const version = versionService.getVersion(versionId);
  if (!version || version.chapter_id !== chapterId) {
    res.status(404).json({ success: false, error: '版本不存在' });
    return;
  }
  const content = await versionService.getVersionContent(projectId, chapterId, version.version_number);
  res.json({ success: true, data: { ...version, content } });
});

router.post('/', validate(createSchema), async (req: Request<VersionParams>, res) => {
  const { projectId, chapterId } = req.params;

  const { readChapter } = await import('../services/fileService.js');
  const content = await readChapter(projectId, chapterId);

  const version = await versionService.saveVersion(
    projectId,
    chapterId,
    content,
    'manual',
    req.body.label,
  );

  if (!version) {
    res.json({ success: true, data: null, error: '内容未变化，跳过保存' });
    return;
  }

  res.status(201).json({ success: true, data: version });
});

router.post('/:versionId/rollback', async (req: Request<VersionParams>, res) => {
  const { projectId, chapterId, versionId } = req.params;
  try {
    const content = await versionService.rollbackToVersion(projectId, chapterId, versionId);
    res.json({ success: true, data: { content } });
  } catch (err) {
    const message = err instanceof Error ? err.message : '回滚失败';
    res.status(400).json({ success: false, error: message });
  }
});

router.delete('/:versionId', async (req: Request<VersionParams>, res) => {
  const { projectId, chapterId, versionId } = req.params;
  const deleted = await versionService.deleteVersion(projectId, chapterId, versionId);
  if (!deleted) {
    res.status(404).json({ success: false, error: '版本不存在' });
    return;
  }
  res.json({ success: true });
});

export default router;
