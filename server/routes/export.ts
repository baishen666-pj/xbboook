import { Router } from 'express';
import { findByProject as findChapters } from '../db/repositories/chapterRepo.js';
import { findByProject as findVolumes } from '../db/repositories/volumeRepo.js';
import { findById as findProject } from '../db/repositories/projectRepo.js';
import * as exportTemplateRepo from '../db/repositories/exportTemplateRepo.js';
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

function htmlToMarkdown(html: string): string {
  let md = html;

  // Headings
  md = md.replace(/<h1[^>]*>(.*?)<\/h1>/gi, (_, c) => `# ${c}`);
  md = md.replace(/<h2[^>]*>(.*?)<\/h2>/gi, (_, c) => `## ${c}`);
  md = md.replace(/<h3[^>]*>(.*?)<\/h3>/gi, (_, c) => `### ${c}`);
  md = md.replace(/<h4[^>]*>(.*?)<\/h4>/gi, (_, c) => `#### ${c}`);

  // Inline formatting
  md = md.replace(/<(strong|b)[^>]*>(.*?)<\/\1>/gi, '**$2**');
  md = md.replace(/<(em|i)[^>]*>(.*?)<\/\1>/gi, '*$2*');
  md = md.replace(/<u[^>]*>(.*?)<\/u>/gi, '$1');
  md = md.replace(/<del[^>]*>(.*?)<\/del>/gi, '~~$1~~');
  md = md.replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`');

  // Block elements
  md = md.replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gis, (_, c) => {
    return c.split('\n').map((l: string) => `> ${l.trim()}`).join('\n');
  });
  md = md.replace(/<hr\s*\/?>/gi, '\n---\n');

  // Lists
  md = md.replace(/<li[^>]*>(.*?)<\/li>/gi, (_, c) => `- ${c.trim()}`);

  // Paragraphs and line breaks
  md = md.replace(/<\/p>/gi, '\n\n');
  md = md.replace(/<br\s*\/?>/gi, '\n');

  // Remove remaining tags
  md = md.replace(/<[^>]+>/g, '');

  // Decode entities
  md = md.replace(/&amp;/g, '&');
  md = md.replace(/&lt;/g, '<');
  md = md.replace(/&gt;/g, '>');
  md = md.replace(/&quot;/g, '"');
  md = md.replace(/&#39;/g, "'");
  md = md.replace(/&nbsp;/g, ' ');

  // Clean up whitespace
  md = md.replace(/\n{3,}/g, '\n\n');
  return md.trim();
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

async function buildChapterGroups(
  projectId: string,
  chapterIds?: Set<string>
): Promise<ChapterGroup[]> {
  const chapters = findChapters(projectId);
  const filtered = chapterIds
    ? chapters.filter((ch) => chapterIds.has(ch.id))
    : chapters;
  const volumes = findVolumes(projectId);
  const volumeMap = new Map(volumes.map((v) => [v.id, v.title]));

  const readResults = await Promise.all(
    filtered.map(async (ch) => {
      const content = await readChapter(projectId, ch.id);
      return { ch, content };
    }),
  );

  const unassigned: ChapterGroup['chapters'] = [];
  const byVolume = new Map<string, ChapterGroup['chapters']>();

  for (const { ch, content } of readResults) {
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

function parseExportOptions(query: Record<string, unknown>): {
  chapterIds: Set<string> | undefined;
  includeToc: boolean;
  includeCover: boolean;
} {
  const chaptersParam = query.chapters as string | undefined;
  const chapterIds = chaptersParam
    ? new Set(chaptersParam.split(',').filter(Boolean))
    : undefined;
  const includeToc = query.includeToc !== 'false';
  const includeCover = query.includeCover !== 'false';
  return { chapterIds, includeToc, includeCover };
}

// Export as TXT
router.get('/txt', async (req, res) => {
  const { projectId } = req.params as { projectId: string };

  const opts = parseExportOptions(req.query as Record<string, unknown>);
  const groups = await buildChapterGroups(projectId, opts.chapterIds);
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

// Export as Markdown (enhanced: converts HTML to proper Markdown)
router.get('/md', async (req, res) => {
  const { projectId } = req.params as { projectId: string };

  const opts = parseExportOptions(req.query as Record<string, unknown>);
  const groups = await buildChapterGroups(projectId, opts.chapterIds);
  if (groups.length === 0 || groups.every((g) => g.chapters.length === 0)) {
    res.status(404).json({ success: false, error: '没有可导出的章节' });
    return;
  }

  const project = findProject(projectId);

  const parts: string[] = [];
  if (project?.name) parts.push(`# ${project.name}\n`);
  if (project?.description) parts.push(`> ${project.description}\n`);

  for (const group of groups) {
    if (group.volumeTitle) {
      parts.push(`## ${group.volumeTitle}`);
    }
    for (const ch of group.chapters) {
      parts.push(`### ${ch.title}\n`);
      const content = isHtmlContent(ch.content) ? htmlToMarkdown(ch.content) : ch.content;
      parts.push(content);
    }
  }

  res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(project?.name || projectId)}.md"`);
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
    const opts = parseExportOptions(req.query as Record<string, unknown>);
  const groups = await buildChapterGroups(projectId, opts.chapterIds);
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
    const opts = parseExportOptions(req.query as Record<string, unknown>);
  const groups = await buildChapterGroups(projectId, opts.chapterIds);
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
    const opts = parseExportOptions(req.query as Record<string, unknown>);
  const groups = await buildChapterGroups(projectId, opts.chapterIds);
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

// Export as WeChat-compatible HTML
router.get('/wechat', async (req, res) => {
  const { projectId } = req.params as { projectId: string };
  const templateId = req.query.template as string | undefined;

  try {
    const opts = parseExportOptions(req.query as Record<string, unknown>);
    const groups = await buildChapterGroups(projectId, opts.chapterIds);
    if (groups.length === 0 || groups.every((g) => g.chapters.length === 0)) {
      res.status(404).json({ success: false, error: '没有可导出的章节' });
      return;
    }

    const project = findProject(projectId);
    const projectName = project?.name || 'Novel';

    const template = templateId
      ? exportTemplateRepo.findById(templateId)
      : exportTemplateRepo.findByPlatform('wechat')[0];

    const css = template?.css || `
body { font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif; color: #333; line-height: 1.75; font-size: 15px; }
h1 { text-align: center; font-size: 22px; font-weight: bold; margin: 20px 0; }
h2 { font-size: 18px; font-weight: bold; margin: 16px 0; border-left: 4px solid #1a73e8; padding-left: 10px; }
p { text-indent: 2em; margin: 10px 0; }
`;

    let html = `<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(projectName)}</title>
<style>${css}</style>
</head>
<body>`;

    if (template?.header_html) {
      html += template.header_html;
    }

    if (opts.includeToc) {
      html += '<h1>目录</h1>';
      for (const group of groups) {
        if (group.volumeTitle) html += `<h2>${escapeHtml(group.volumeTitle)}</h2>`;
        for (const ch of group.chapters) {
          html += `<p>${escapeHtml(ch.title)}</p>`;
        }
      }
      html += '<hr/>';
    }

    for (const group of groups) {
      if (group.volumeTitle) {
        html += `<h1>${escapeHtml(group.volumeTitle)}</h1>`;
      }
      for (const ch of group.chapters) {
        html += `<h2>${escapeHtml(ch.title)}</h2>`;
        const htmlContent = isHtmlContent(ch.content) ? sanitizeHtml(ch.content) : textToHtml(ch.content);
        html += htmlContent;
      }
    }

    if (template?.footer_html) {
      html += template.footer_html;
    }

    html += '</body></html>';

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(projectName)}_wechat.html"`);
    res.send(html);
  } catch {
    res.status(500).json({ success: false, error: '微信 HTML 导出失败' });
  }
});

// Export templates CRUD
router.get('/templates', (_req, res) => {
  const templates = exportTemplateRepo.findAll();
  res.json({ success: true, data: templates });
});

router.get('/templates/:templateId', (req, res) => {
  const template = exportTemplateRepo.findById(req.params.templateId);
  if (!template) {
    res.status(404).json({ success: false, error: '模板不存在' });
    return;
  }
  res.json({ success: true, data: template });
});

router.post('/templates', (req, res) => {
  const { name, platform, description, css, headerHtml, footerHtml } = req.body;
  if (!name || !platform || !css) {
    res.status(400).json({ success: false, error: 'name, platform, css 必填' });
    return;
  }
  const template = exportTemplateRepo.create({ name, platform, description, css, headerHtml, footerHtml });
  res.status(201).json({ success: true, data: template });
});

router.patch('/templates/:templateId', (req, res) => {
  const updated = exportTemplateRepo.update(req.params.templateId, req.body);
  if (!updated) {
    res.status(404).json({ success: false, error: '模板不存在或为内置模板' });
    return;
  }
  res.json({ success: true, data: updated });
});

router.delete('/templates/:templateId', (req, res) => {
  const deleted = exportTemplateRepo.deleteById(req.params.templateId);
  if (!deleted) {
    res.status(404).json({ success: false, error: '模板不存在或为内置模板' });
    return;
  }
  res.json({ success: true, data: null });
});

export default router;
