import { Router } from 'express';
import multer from 'multer';
import { create as createChapter } from '../db/repositories/chapterRepo.js';
import { writeChapter } from '../services/fileService.js';
import mammoth from 'mammoth';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
});

const router = Router();

interface ImportChapter {
  title: string;
  content: string;
}

function isChapterHeading(text: string): boolean {
  const t = text.trim();
  if (/^第[一二三四五六七八九十百千零\d]+[章回幕集]/.test(t)) return true;
  if (/^第[一二三四五六七八九十百千零\d]+节(?:\s|$)/.test(t)) return true;
  if (/^Chapter\s+\d+/i.test(t)) return true;
  return false;
}

export function splitTxtIntoChapters(text: string): ImportChapter[] {
  const patterns = [
    /^(第[一二三四五六七八九十百千零\d]+[章回幕集][\s\S]*?)$/gm,
    /^(第[一二三四五六七八九十百千零\d]+节(?:\s[\s\S]*?)?)$/gm,
    /^(Chapter\s+\d+[^\n]*)$/gim,
  ];

  for (const pattern of patterns) {
    const matches = [...text.matchAll(pattern)];
    if (matches.length >= 2) {
      const chapters: ImportChapter[] = [];
      for (let i = 0; i < matches.length; i++) {
        const start = matches[i].index! + matches[i][0].length;
        const end = i + 1 < matches.length ? matches[i + 1].index! : text.length;
        const title = matches[i][1].trim() || matches[i][0].trim();
        const content = text.slice(start, end).trim();
        if (content) chapters.push({ title, content });
      }
      return chapters;
    }
  }

  const trimmed = text.trim();
  if (trimmed) {
    return [{ title: '第一章', content: trimmed }];
  }
  return [];
}

export function splitHtmlIntoChapters(html: string): ImportChapter[] {
  const blockRe = /<(p|h[1-6])[^>]*>([\s\S]*?)<\/\1>/gi;
  const blocks = [...html.matchAll(blockRe)];

  if (blocks.length === 0) {
    const text = html.replace(/<[^>]+>/g, '').trim();
    return text ? [{ title: '第一章', content: html }] : [];
  }

  const headingIndices: number[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const text = blocks[i][2].replace(/<[^>]+>/g, '').trim();
    if (isChapterHeading(text)) {
      headingIndices.push(i);
    }
  }

  if (headingIndices.length < 2) {
    return [{ title: '第一章', content: html }];
  }

  const chapters: ImportChapter[] = [];
  for (let i = 0; i < headingIndices.length; i++) {
    const start = blocks[headingIndices[i]].index!;
    const end = i + 1 < headingIndices.length ? blocks[headingIndices[i + 1]].index! : html.length;
    const title = blocks[headingIndices[i]][2].replace(/<[^>]+>/g, '').trim();
    const content = html.slice(start, end).trim();

    if (content.replace(/<[^>]+>/g, '').trim()) {
      chapters.push({ title, content });
    }
  }

  return chapters.length > 0 ? chapters : [{ title: '第一章', content: html }];
}

export function splitMdIntoChapters(text: string): ImportChapter[] {
  const lines = text.split('\n');
  const chapters: ImportChapter[] = [];
  let currentTitle = '第一章';
  let currentLines: string[] = [];

  for (const line of lines) {
    const headingMatch = line.match(/^#{1,3}\s+(.+)/);
    if (headingMatch) {
      if (currentLines.length > 0 && currentLines.some((l) => l.trim())) {
        chapters.push({ title: currentTitle, content: currentLines.join('\n').trim() });
      }
      currentTitle = headingMatch[1].trim();
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  }

  if (currentLines.length > 0 && currentLines.some((l) => l.trim())) {
    chapters.push({ title: currentTitle, content: currentLines.join('\n').trim() });
  }

  return chapters;
}

router.post('/:projectId/import', upload.single('file'), async (req, res) => {
  const { projectId } = req.params as { projectId: string };
  const file = req.file;

  if (!file) {
    res.status(400).json({ success: false, error: '请选择文件' });
    return;
  }

  const ext = (file.originalname || '').split('.').pop()?.toLowerCase();
  let chapters: ImportChapter[];
  let warnings: string[] = [];

  try {
    if (ext === 'docx') {
      const result = await mammoth.convertToHtml({ buffer: file.buffer });
      chapters = splitHtmlIntoChapters(result.value);
      warnings = result.messages
        .filter((m) => m.type === 'warning')
        .map((m) => m.message);
    } else if (ext === 'md') {
      const text = file.buffer.toString('utf-8');
      chapters = splitMdIntoChapters(text);
    } else if (ext === 'txt') {
      const text = file.buffer.toString('utf-8');
      chapters = splitTxtIntoChapters(text);
    } else {
      res.status(400).json({ success: false, error: `不支持的文件格式: .${ext}（支持 .txt, .md, .docx）` });
      return;
    }

    if (chapters.length === 0) {
      res.status(400).json({ success: false, error: '文件内容为空' });
      return;
    }

    const created = [];
    for (const ch of chapters) {
      const chapter = await createChapter({
        projectId,
        title: ch.title.slice(0, 200),
      });
      await writeChapter(projectId, chapter.id, ch.content);
      created.push({ id: chapter.id, title: ch.title, words: ch.content.length });
    }

    const response: Record<string, unknown> = {
      success: true,
      data: {
        imported: created.length,
        chapters: created,
      },
    };
    if (warnings.length > 0) {
      response.warnings = warnings;
    }
    res.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : '导入失败';
    res.status(500).json({ success: false, error: message });
  }
});

export default router;
