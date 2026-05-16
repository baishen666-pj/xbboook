import { Router } from 'express';
import { findByProject as findChapters } from '../db/repositories/chapterRepo.js';
import { findByProject as findVolumes } from '../db/repositories/volumeRepo.js';
import { findById as findProject } from '../db/repositories/projectRepo.js';
import { readChapter } from '../services/fileService.js';
import fs from 'fs';
import path from 'path';

const router = Router({ mergeParams: true });

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function isHtmlContent(text: string): boolean {
  return /<[a-z][\s\S]*>/i.test(text);
}

function textToHtml(text: string): string {
  return text
    .split('\n')
    .map((p) => (p.trim() ? `<p>${escapeHtml(p)}</p>` : '<p><br/></p>'))
    .join('\n');
}

function sanitizeHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/ on\w+="[^"]*"/gi, '')
    .replace(/ on\w+='[^']*'/gi, '')
    .replace(/ javascript:/gi, '');
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ');
}

const CJK_FONT_PATH = (() => {
  const candidates = [
    'C:/Windows/Fonts/simhei.ttf',
    'C:/Windows/Fonts/msyh.ttc',
    'C:/Windows/Fonts/simsun.ttc',
    '/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc',
    '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',
    '/usr/share/fonts/noto-cjk/NotoSansCJK-Regular.ttc',
    '/System/Library/Fonts/PingFang.ttc',
    '/System/Library/Fonts/STHeiti Light.ttc',
  ];
  for (const f of candidates) {
    if (fs.existsSync(f)) return f;
  }
  return '';
})();

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
      const content = isHtmlContent(ch.content) ? stripHtml(ch.content) : ch.content;
      parts.push(`${ch.title}\n${'─'.repeat(40)}\n\n${content}`);
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
      const content = isHtmlContent(ch.content) ? stripHtml(ch.content) : ch.content;
      parts.push(`## ${ch.title}\n\n${content}`);
    }
  }

  res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(projectId)}.md"`);
  res.send(parts.join('\n\n---\n\n'));
});

const EPUB_CSS = `
body { font-family: "PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif; line-height: 1.8; padding: 0 1em; }
h1 { text-align: center; font-size: 1.6em; margin: 1.5em 0 0.8em; border-bottom: 2px solid #333; padding-bottom: 0.3em; }
h2 { font-size: 1.3em; margin: 1.2em 0 0.6em; page-break-before: always; }
h2:first-of-type { page-break-before: auto; }
p { text-indent: 2em; margin: 0.4em 0; font-size: 1em; }
.volume-title { text-align: center; font-size: 1.5em; font-weight: bold; margin: 2em 0 1em; letter-spacing: 0.1em; }
strong, b { font-weight: bold; }
em, i { font-style: italic; }
`;

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

    const content: Array<{ title: string; content: string }> = [];

    for (const group of groups) {
      if (group.volumeTitle) {
        content.push({
          title: group.volumeTitle,
          content: `<div class="volume-title">${escapeHtml(group.volumeTitle)}</div>`,
        });
      }
      for (const ch of group.chapters) {
        const htmlContent = isHtmlContent(ch.content) ? sanitizeHtml(ch.content) : textToHtml(ch.content);
        content.push({ title: ch.title, content: htmlContent });
      }
    }

    const buffer: Buffer = await epubGen.default(
      {
        title: projectName,
        author: 'xbboook Author',
        lang: 'zh',
        description: project?.description || undefined,
        css: EPUB_CSS,
        tocTitle: '目录',
        appendChapterTitles: true,
      },
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

        const text = isHtmlContent(ch.content) ? stripHtml(ch.content) : ch.content;
        const paragraphs = text.split('\n');
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
    const doc = new PDFDocument({
      size: 'A4',
      margin: 60,
      info: {
        Title: projectName,
        Author: 'xbboook Author',
        Subject: project?.description || '',
      },
    });

    const hasCjkFont = CJK_FONT_PATH !== '';
    if (hasCjkFont) {
      doc.registerFont('CJK', CJK_FONT_PATH);
    }

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    const endPromise = new Promise<void>((resolve) => doc.on('end', resolve));

    const bodyFont = hasCjkFont ? 'CJK' : 'Helvetica';
    const titleFont = hasCjkFont ? 'CJK' : 'Helvetica-Bold';

    doc.font(titleFont).fontSize(28).text(projectName, { align: 'center' });
    if (project?.description) {
      doc.moveDown(1);
      doc.font(bodyFont).fontSize(12).text(project.description, { align: 'center' });
    }
    doc.moveDown(4);

    doc.font(titleFont).fontSize(16).text('目录', { align: 'center' });
    doc.moveDown(1);
    doc.font(bodyFont).fontSize(11);
    for (const group of groups) {
      if (group.volumeTitle) {
        doc.font(titleFont).fontSize(12).text(group.volumeTitle);
        doc.font(bodyFont).fontSize(11);
      }
      for (const ch of group.chapters) {
        doc.text(`  ${ch.title}`);
      }
    }

        doc.addPage();

    for (const group of groups) {
      if (group.volumeTitle) {
        doc.font(titleFont).fontSize(20).text(group.volumeTitle, { align: 'center' });
        doc.moveDown(1);
      }
      for (const ch of group.chapters) {
        doc.font(titleFont).fontSize(16).text(ch.title, { align: 'center' });
        doc.moveDown(0.5);
        const text = isHtmlContent(ch.content) ? stripHtml(ch.content) : ch.content;
        const paragraphs = text.split('\n');
        doc.font(bodyFont).fontSize(11);
        for (const p of paragraphs) {
          if (p.trim() === '') {
            doc.moveDown(0.3);
          } else {
            doc.text(p, { lineGap: 5, indent: 20 });
          }
        }
        doc.moveDown(1);
      }
    }

    doc.end();
    await endPromise;

    const buffer = Buffer.concat(chunks);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(projectName)}.pdf"`);
    res.send(buffer);
  } catch {
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: 'PDF 导出失败' });
    }
  }
});

export default router;
