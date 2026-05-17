import { Router } from 'express';
import { z } from 'zod';
import * as repo from '../db/repositories/platformPublishRepo.js';
import { chapterRepo } from '../db/repositories/chapterRepo.js';
import { validate } from '../middleware/validate.js';

const router = Router({ mergeParams: true });

const PLATFORMS = ['qidian', 'fanqie', 'jinjiang', 'zongheng', 'other'] as const;

const configSchema = z.object({
  platform: z.enum(PLATFORMS),
  config: z.record(z.unknown()).optional(),
  chapterMapping: z.record(z.unknown()).optional(),
});

interface PlatformAdapter {
  name: string;
  formatChapter: (title: string, content: string, config: Record<string, unknown>) => string;
  formatBook: (chapters: { title: string; content: string }[], config: Record<string, unknown>) => string;
  fileExtension: string;
  mimeType: string;
}

const adapters: Record<string, PlatformAdapter> = {
  qidian: {
    name: '起点中文网',
    formatChapter(title, content, config) {
      const maxLen = (config.maxLength as number) || 3000;
      let formatted = `\n${title}\n\n`;
      formatted += content;
      if (formatted.length > maxLen) formatted = formatted.slice(0, maxLen) + '...（因平台限制已截断）';
      return formatted;
    },
    formatBook(chapters, config) {
      return chapters.map(c => this.formatChapter(c.title, c.content, config)).join('\n\n---\n\n');
    },
    fileExtension: 'txt',
    mimeType: 'text/plain',
  },
  fanqie: {
    name: '番茄小说',
    formatChapter(title, content, config) {
      const indent = (config.indent as string) || '　　';
      const paragraphs = content.split(/\n+/).filter(Boolean).map(p => `${indent}${p.trim()}`);
      return `${title}\n\n${paragraphs.join('\n')}`;
    },
    formatBook(chapters, config) {
      return chapters.map(c => this.formatChapter(c.title, c.content, config)).join('\n\n---\n\n');
    },
    fileExtension: 'txt',
    mimeType: 'text/plain',
  },
  jinjiang: {
    name: '晋江文学城',
    formatChapter(title, content, config) {
      const maxLen = (config.maxLength as number) || 5000;
      let formatted = `【${title}】\n\n${content}`;
      if (formatted.length > maxLen) formatted = formatted.slice(0, maxLen);
      return formatted;
    },
    formatBook(chapters, config) {
      return chapters.map(c => this.formatChapter(c.title, c.content, config)).join('\n\n==========\n\n');
    },
    fileExtension: 'txt',
    mimeType: 'text/plain',
  },
  zongheng: {
    name: '纵横中文网',
    formatChapter(title, content) {
      return `第 ${title}\n\n${content}`;
    },
    formatBook(chapters, config) {
      return chapters.map(c => this.formatChapter(c.title, c.content, config)).join('\n\n---\n\n');
    },
    fileExtension: 'txt',
    mimeType: 'text/plain',
  },
  other: {
    name: '通用格式',
    formatChapter(title, content) {
      return `# ${title}\n\n${content}`;
    },
    formatBook(chapters) {
      return chapters.map(c => this.formatChapter(c.title, c.content, {})).join('\n\n---\n\n');
    },
    fileExtension: 'md',
    mimeType: 'text/markdown',
  },
};

router.get('/platforms', (_req, res) => {
  const list = PLATFORMS.map(p => ({ id: p, name: adapters[p].name, extension: adapters[p].fileExtension }));
  res.json({ success: true, data: list });
});

router.get('/configs', (req, res) => {
  const configs = repo.findByProject(req.params.projectId);
  res.json({ success: true, data: configs });
});

router.post('/configs', validate(configSchema), (req, res) => {
  const config = repo.upsert({ id: crypto.randomUUID(), projectId: req.params.projectId, ...req.body });
  res.status(201).json({ success: true, data: config });
});

router.delete('/configs/:platform', (req, res) => {
  if (!repo.remove(req.params.projectId, req.params.platform)) {
    return res.status(404).json({ success: false, error: '配置不存在' });
  }
  res.json({ success: true });
});

router.post('/export', validate(z.object({ platform: z.enum(PLATFORMS), chapterIds: z.array(z.string()).optional() })), (req, res) => {
  const { projectId } = req.params;
  const { platform, chapterIds } = req.body;
  const adapter = adapters[platform];
  const configRecord = repo.findByPlatform(projectId, platform);
  const config = configRecord?.config || {};

  const chapters = chapterIds?.length
    ? chapterIds.flatMap((id: string) => { const c = chapterRepo.findById(id); return c ? [c] : []; })
    : chapterRepo.findByProject(projectId);

  const formatted = adapter.formatBook(
    chapters.map(c => ({ title: c.title, content: c.content || '' })),
    config,
  );

  repo.updateLastExport(projectId, platform);

  res.setHeader('Content-Type', adapter.mimeType);
  res.setHeader('Content-Disposition', `attachment; filename="${projectId}-${platform}.${adapter.fileExtension}"`);
  res.send(formatted);
});

export default router;
