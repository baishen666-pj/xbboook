import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { splitMdIntoChapters, splitTxtIntoChapters } from '../../server/routes/import.js';

describe('Import Functions', () => {
  describe('splitTxtIntoChapters', () => {
    it('splits by Chinese chapter headings', () => {
      const text = '第一章 开始\n内容1\n第二章 发展\n内容2\n第三章 高潮\n内容3';
      const chapters = splitTxtIntoChapters(text);
      expect(chapters).toHaveLength(3);
    });

    it('returns single chapter for no headings', () => {
      const text = '这是一段没有章节标题的纯文本内容。';
      const chapters = splitTxtIntoChapters(text);
      expect(chapters).toHaveLength(1);
      expect(chapters[0].title).toBe('第一章');
    });

    it('handles empty text', () => {
      expect(splitTxtIntoChapters('')).toHaveLength(0);
      expect(splitTxtIntoChapters('   ')).toHaveLength(0);
    });

    it('splits by English chapter headings', () => {
      const text = 'Chapter 1 Start\ncontent1\nChapter 2 Middle\ncontent2';
      const chapters = splitTxtIntoChapters(text);
      expect(chapters.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('splitMdIntoChapters', () => {
    it('splits by markdown headings', () => {
      const text = '# 第一章\n内容1\n## 第一节\n更多内容\n# 第二章\n内容2';
      const chapters = splitMdIntoChapters(text);
      expect(chapters).toHaveLength(3);
      expect(chapters[0].title).toBe('第一章');
    });

    it('returns single chapter for no headings', () => {
      const text = '纯文本内容';
      const chapters = splitMdIntoChapters(text);
      expect(chapters).toHaveLength(1);
      expect(chapters[0].title).toBe('第一章');
    });

    it('handles empty text', () => {
      expect(splitMdIntoChapters('')).toHaveLength(0);
      expect(splitMdIntoChapters('\n\n')).toHaveLength(0);
    });

    it('supports h2 and h3 headings', () => {
      const text = '## 起因\n内容1\n### 细节\n细节内容\n## 经过\n内容2';
      const chapters = splitMdIntoChapters(text);
      expect(chapters.length).toBeGreaterThanOrEqual(2);
    });
  });
});
