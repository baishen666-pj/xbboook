import { Router } from 'express';
import { findByProject as findChapters } from '../db/repositories/chapterRepo.js';
import { findByProject as findVolumes } from '../db/repositories/volumeRepo.js';
import { findById as findProject } from '../db/repositories/projectRepo.js';
import { readChapter } from '../services/fileService.js';

const router = Router({ mergeParams: true });

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

interface ChapterGroup {
  volumeTitle: string;
  chapters: Array<{ title: string; content: string }>;
}

async function buildChapterGroups(projectId: string): Promise<ChapterGroup[]> {
  const chapters = findChapters(projectId);
  const volumes = findVolumes(projectId);
  const volumeMap = new Map(volumes.map((v) => [v.id, v.title]));

  const unassigned: ChapterGroup['chapters'] = [];
  const byVolume = new Map<string, ChapterGroup['chapters']>();

  for (const ch of chapters) {
    const content = await readChapter(projectId, ch.id);
    if (ch.volume_id) {
      const list = byVolume.get(ch.volume_id) || [];
      list.push({ title: ch.title, content });
      byVolume.set(ch.volume_id, list);
    } else {
      unassigned.push({ title: ch.title, content });
    }
  }

  const groups: ChapterGroup[] = [];
  if (unassigned.length > 0) {
    groups.push({ volumeTitle: '', chapters: unassigned });
  }
  for (const [volId, volChapters] of byVolume) {
    groups.push({
      volumeTitle: volumeMap.get(volId) || 'Volume',
      chapters: volChapters,
    });
  }

  return groups;
}

// Export as TXT
router.get('/txt', async (req, res) => {
  const { projectId } = req.params as { projectId: string };

  const groups = await buildChapterGroups(projectId);
  if (groups.length === 0 || groups.every((g) => g.chapters.length === 0)) {
    res.status(404).json({ success: false, error: '没有可导出的章节' });
    return;
  }

  const parts: string[] = [];
  for (const group of groups) {
    if (group.volumeTitle) {
      parts.push(`${'='.repeat(50)}\n${group.volumeTitle}\n${'='.repeat(50)}`);
    }
    for (const ch of group.chapters) {
      parts.push(`${ch.title}\n${'─'.repeat(40)}\n\n${ch.content}`);
    }
  }

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(projectId)}.txt"`);
  res.send(parts.join('\n\n'));
});

// Export as Markdown
router.get('/md', async (req, res) => {
  const { projectId } = req.params as { projectId: string };

  const groups = await buildChapterGroups(projectId);
  if (groups.length === 0 || groups.every((g) => g.chapters.length === 0)) {
    res.status(404).json({ success: false, error: '没有可导出的章节' });
    return;
  }

  const parts: string[] = [];
  for (const group of groups) {
    if (group.volumeTitle) {
      parts.push(`# ${group.volumeTitle}`);
    }
    for (const ch of group.chapters) {
      parts.push(`## ${ch.title}\n\n${ch.content}`);
    }
  }

  res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(projectId)}.md"`);
  res.send(parts.join('\n\n---\n\n'));
});

// Export as EPUB
router.get('/epub', async (req, res) => {
  const { projectId } = req.params as { projectId: string };

  try {
    const groups = await buildChapterGroups(projectId);
    if (groups.length === 0 || groups.every((g) => g.chapters.length === 0)) {
      res.status(404).json({ success: false, error: '没有可导出的章节' });
      return;
    }

    const project = findProject(projectId);
    const projectName = project?.name || 'Novel';

    const epubGen = await import('epub-gen-memory');

    const allChapters = groups.flatMap((g) => g.chapters);

    const content = allChapters.map((ch) => ({
      title: ch.title,
      content: ch.content ? ch.content.split('\n').map((p) => `<p>${escapeHtml(p)}</p>`).join('') : '<p></p>',
    }));

    const buffer: Buffer = await epubGen.default(
      { title: projectName, author: 'xbboook Author' },
      content,
    );

    res.setHeader('Content-Type', 'application/epub+zip');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(projectName)}.epub"`);
    res.send(buffer);
  } catch {
    res.status(500).json({ success: false, error: 'EPUB 导出失败' });
  }
});

// Export as DOCX
router.get('/docx', async (req, res) => {
  const { projectId } = req.params as { projectId: string };

  try {
    const groups = await buildChapterGroups(projectId);
    if (groups.length === 0 || groups.every((g) => g.chapters.length === 0)) {
      res.status(404).json({ success: false, error: '没有可导出的章节' });
      return;
    }

    const project = findProject(projectId);
    const projectName = project?.name || 'Novel';

    const docx = await import('docx');
    const { Document, Packer, Paragraph, TextRun, HeadingLevel } = docx;

    const children: InstanceType<typeof Paragraph>[] = [];

    // Title
    children.push(new Paragraph({
      text: projectName,
      heading: HeadingLevel.TITLE,
    }));

    children.push(new Paragraph({ text: '' }));

    for (const group of groups) {
      if (group.volumeTitle) {
        children.push(new Paragraph({
          text: group.volumeTitle,
          heading: HeadingLevel.HEADING_1,
        }));
      }

      for (const ch of group.chapters) {
        children.push(new Paragraph({
          text: ch.title,
          heading: HeadingLevel.HEADING_2,
        }));

        const paragraphs = (ch.content || '').split('\n');
        for (const p of paragraphs) {
          children.push(new Paragraph({
            children: [new TextRun(p)],
          }));
        }

        children.push(new Paragraph({ text: '' }));
      }
    }

    const doc = new Document({
      sections: [{ children }],
    });

    const buffer = await Packer.toBuffer(doc);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(projectName)}.docx"`);
    res.send(buffer);
  } catch {
    res.status(500).json({ success: false, error: 'DOCX 导出失败' });
  }
});

// Export as PDF
router.get('/pdf', async (req, res) => {
  const { projectId } = req.params as { projectId: string };

  try {
    const groups = await buildChapterGroups(projectId);
    if (groups.length === 0 || groups.every((g) => g.chapters.length === 0)) {
      res.status(404).json({ success: false, error: '没有可导出的章节' });
      return;
    }

    const project = findProject(projectId);
    const projectName = project?.name || 'Novel';

    const PDFDocument = (await import('pdfkit')).default;
    const doc = new PDFDocument({ size: 'A4', margin: 60, info: { Title: projectName } });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(projectName)}.pdf"`);
    doc.pipe(res);

    doc.fontSize(24).text(projectName, { align: 'center' });
    doc.moveDown(2);

    for (const group of groups) {
      if (group.volumeTitle) {
        doc.fontSize(18).text(group.volumeTitle, { align: 'center' });
        doc.moveDown(1);
      }

      for (const ch of group.chapters) {
        doc.fontSize(14).text(ch.title);
        doc.moveDown(0.5);

        const paragraphs = (ch.content || '').split('\n');
        for (const p of paragraphs) {
          if (p.trim() === '') {
            doc.moveDown(0.5);
          } else {
            doc.fontSize(11).text(p, { lineGap: 4 });
          }
        }

        doc.moveDown(1);
      }
    }

    doc.end();
  } catch {
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: 'PDF 导出失败' });
    }
  }
});

export default router;
