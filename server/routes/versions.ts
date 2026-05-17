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

// Diff between two versions
router.get('/:versionId/diff/:otherVersionId', async (req: Request<VersionParams & { otherVersionId: string }>, res) => {
  const { projectId, chapterId, versionId, otherVersionId } = req.params;

  const v1 = versionService.getVersion(versionId);
  const v2 = versionService.getVersion(otherVersionId);
  if (!v1 || !v2 || v1.chapter_id !== chapterId || v2.chapter_id !== chapterId) {
    res.status(404).json({ success: false, error: '版本不存在' });
    return;
  }

  const content1 = await versionService.getVersionContent(projectId, chapterId, v1.version_number);
  const content2 = await versionService.getVersionContent(projectId, chapterId, v2.version_number);

  const hunks = computeDiff(content1, content2);

  res.json({
    success: true,
    data: {
      left: { id: v1.id, versionNumber: v1.version_number, label: v1.label, createdAt: v1.created_at },
      right: { id: v2.id, versionNumber: v2.version_number, label: v2.label, createdAt: v2.created_at },
      hunks,
      stats: { added: hunks.filter(h => h.type === 'add').reduce((s, h) => s + h.lines.length, 0), removed: hunks.filter(h => h.type === 'remove').reduce((s, h) => s + h.lines.length, 0), unchanged: hunks.filter(h => h.type === 'equal').reduce((s, h) => s + h.lines.length, 0) },
    },
  });
});

interface DiffHunk {
  type: 'add' | 'remove' | 'equal';
  lines: string[];
}

function computeDiff(oldText: string, newText: string): DiffHunk[] {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  const hunks: DiffHunk[] = [];

  const maxLen = Math.max(oldLines.length, newLines.length);
  let i = 0;

  while (i < maxLen) {
    const oldLine = i < oldLines.length ? oldLines[i] : undefined;
    const newLine = i < newLines.length ? newLines[i] : undefined;

    if (oldLine === newLine) {
      hunks.push({ type: 'equal', lines: [oldLine!] });
      i++;
    } else {
      const added: string[] = [];
      const removed: string[] = [];
      let oi = i;
      let ni = i;

      while (oi < oldLines.length && ni < newLines.length && oldLines[oi] !== newLines[ni]) {
        if (ni < newLines.length) { added.push(newLines[ni]); ni++; }
        if (oi < oldLines.length && (ni >= newLines.length || oldLines[oi] !== newLines[Math.min(ni, newLines.length - 1)])) {
          removed.push(oldLines[oi]); oi++;
        }
      }

      if (removed.length > 0) hunks.push({ type: 'remove', lines: removed });
      if (added.length > 0) hunks.push({ type: 'add', lines: added });
      i = Math.max(oi, ni);
    }
  }

  // Merge adjacent same-type hunks
  const merged: DiffHunk[] = [];
  for (const hunk of hunks) {
    const last = merged[merged.length - 1];
    if (last && last.type === hunk.type) {
      last.lines.push(...hunk.lines);
    } else {
      merged.push({ ...hunk, lines: [...hunk.lines] });
    }
  }

  return merged;
}

export default router;
