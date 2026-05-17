import { Router } from 'express';
import { z } from 'zod';
import { getDb } from '../db/database.js';
import { readChapter } from '../services/fileService.js';
import { getVersionContent } from '../services/versionService.js';
import { validate } from '../middleware/validate.js';

const router = Router({ mergeParams: true });

const compareSchema = z.object({
  chapterIdA: z.string().min(1, 'chapterIdA 必填'),
  chapterIdB: z.string().min(1, 'chapterIdB 必填'),
  versionIdA: z.string().optional(),
  versionIdB: z.string().optional(),
});

router.post('/compare', validate(compareSchema), async (req, res) => {
  const { projectId } = req.params as { projectId: string };
  const { chapterIdA, chapterIdB, versionIdA, versionIdB } = req.body;

  try {
    const db = getDb();

    const chapterA = db.prepare('SELECT id, title FROM chapters WHERE id = ? AND project_id = ?')
      .get(chapterIdA, projectId) as { id: string; title: string } | undefined;
    const chapterB = db.prepare('SELECT id, title FROM chapters WHERE id = ? AND project_id = ?')
      .get(chapterIdB, projectId) as { id: string; title: string } | undefined;

    if (!chapterA) {
      return res.status(404).json({ success: false, error: '章节 A 不存在' });
    }
    if (!chapterB) {
      return res.status(404).json({ success: false, error: '章节 B 不存在' });
    }

    let contentA: string;
    let contentB: string;

    if (versionIdA) {
      const versionA = db.prepare('SELECT id, chapter_id, version_number FROM chapter_versions WHERE id = ?')
        .get(versionIdA) as { id: string; chapter_id: string; version_number: number } | undefined;
      if (!versionA) {
        return res.status(404).json({ success: false, error: '版本 A 不存在' });
      }
      contentA = await getVersionContent(projectId, versionA.chapter_id, versionA.version_number);
    } else {
      contentA = await readChapter(projectId, chapterIdA);
    }

    if (versionIdB) {
      const versionB = db.prepare('SELECT id, chapter_id, version_number FROM chapter_versions WHERE id = ?')
        .get(versionIdB) as { id: string; chapter_id: string; version_number: number } | undefined;
      if (!versionB) {
        return res.status(404).json({ success: false, error: '版本 B 不存在' });
      }
      contentB = await getVersionContent(projectId, versionB.chapter_id, versionB.version_number);
    } else {
      contentB = await readChapter(projectId, chapterIdB);
    }

    res.json({
      success: true,
      data: {
        chapterA: { id: chapterA.id, title: chapterA.title, content: contentA },
        chapterB: { id: chapterB.id, title: chapterB.title, content: contentB },
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : '章节对比失败';
    res.status(500).json({ success: false, error: message });
  }
});

export default router;
