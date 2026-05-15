import { Router } from 'express';
import { findByProject as findChapters } from '../db/repositories/chapterRepo.js';
import { findByProject as findVolumes } from '../db/repositories/volumeRepo.js';
import { readChapter } from '../services/fileService.js';

const router = Router({ mergeParams: true });

// Export as TXT
router.get('/txt', async (req, res) => {
  const { projectId } = req.params as { projectId: string };

  try {
    const chapters = findChapters(projectId);
    if (chapters.length === 0) {
      res.status(404).json({ success: false, error: 'No chapters to export' });
      return;
    }

    const parts: string[] = [];
    const volumes = findVolumes(projectId);
    const volumeMap = new Map(volumes.map((v) => [v.id, v.title]));

    // Group chapters by volume
    const unassigned: typeof chapters = [];
    const byVolume = new Map<string, typeof chapters>();

    for (const ch of chapters) {
      if (ch.volume_id) {
        const list = byVolume.get(ch.volume_id) || [];
        list.push(ch);
        byVolume.set(ch.volume_id, list);
      } else {
        unassigned.push(ch);
      }
    }

    for (const ch of unassigned) {
      const content = readChapter(projectId, ch.id);
      parts.push(`${ch.title}\n${'─'.repeat(40)}\n\n${content}`);
    }

    for (const [volId, volChapters] of byVolume) {
      const volTitle = volumeMap.get(volId) || '未命名卷';
      parts.push(`${'═'.repeat(50)}\n${volTitle}\n${'═'.repeat(50)}`);
      for (const ch of volChapters) {
        const content = readChapter(projectId, ch.id);
        parts.push(`\n${ch.title}\n${'─'.repeat(40)}\n\n${content}`);
      }
    }

    const text = parts.join('\n\n');
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(projectId)}.txt"`);
    res.send(text);
  } catch (err) {
    res.status(500).json({ success: false, error: 'Export failed' });
  }
});

// Export as Markdown
router.get('/md', async (req, res) => {
  const { projectId } = req.params as { projectId: string };

  try {
    const chapters = findChapters(projectId);
    if (chapters.length === 0) {
      res.status(404).json({ success: false, error: 'No chapters to export' });
      return;
    }

    const volumes = findVolumes(projectId);
    const volumeMap = new Map(volumes.map((v) => [v.id, v.title]));
    const parts: string[] = [];

    const unassigned: typeof chapters = [];
    const byVolume = new Map<string, typeof chapters>();

    for (const ch of chapters) {
      if (ch.volume_id) {
        const list = byVolume.get(ch.volume_id) || [];
        list.push(ch);
        byVolume.set(ch.volume_id, list);
      } else {
        unassigned.push(ch);
      }
    }

    for (const ch of unassigned) {
      const content = readChapter(projectId, ch.id);
      parts.push(`## ${ch.title}\n\n${content}`);
    }

    for (const [volId, volChapters] of byVolume) {
      const volTitle = volumeMap.get(volId) || '未命名卷';
      parts.push(`# ${volTitle}`);
      for (const ch of volChapters) {
        const content = readChapter(projectId, ch.id);
        parts.push(`## ${ch.title}\n\n${content}`);
      }
    }

    const md = parts.join('\n\n---\n\n');
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(projectId)}.md"`);
    res.send(md);
  } catch (err) {
    res.status(500).json({ success: false, error: 'Export failed' });
  }
});

export default router;
