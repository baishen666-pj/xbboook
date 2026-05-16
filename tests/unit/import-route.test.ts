import { describe, it, expect } from 'vitest';
import { splitTxtIntoChapters, splitMdIntoChapters } from '../../server/routes/import';

describe('Import - text splitting logic', () => {
  describe('TXT chapter splitting', () => {
    it('should split by "第X章" markers', () => {
      const text = `第一章 开始
这是第一章的内容。
更多内容。

第二章 发展
这是第二章的内容。

第三章 高潮
这是第三章的内容。`;

      const chapters = splitTxtIntoChapters(text);
      expect(chapters.length).toBe(3);
      expect(chapters[0].title).toContain('第一章');
      expect(chapters[0].content).toContain('这是第一章的内容');
      expect(chapters[1].title).toContain('第二章');
      expect(chapters[2].title).toContain('第三章');
    });

    it('should return single chapter when no markers found', () => {
      const text = '这是一段没有章节标记的文本。';
      const chapters = splitTxtIntoChapters(text);
      expect(chapters.length).toBe(1);
      expect(chapters[0].title).toBe('第一章');
      expect(chapters[0].content).toBe(text);
    });

    it('should handle empty text', () => {
      const chapters = splitTxtIntoChapters('');
      expect(chapters.length).toBe(0);
    });

    it('should split by "Chapter N" markers', () => {
      const text = `Chapter 1 The Beginning
Content of chapter 1.

Chapter 2 The Journey
Content of chapter 2.`;

      const chapters = splitTxtIntoChapters(text);
      expect(chapters.length).toBe(2);
      expect(chapters[0].title).toContain('Chapter 1');
      expect(chapters[1].title).toContain('Chapter 2');
    });
  });

  describe('MD chapter splitting', () => {
    it('should split by markdown headings', () => {
      const text = `# 第一章 开始
第一章内容。

## 第一节
第一节内容。

# 第二章 发展
第二章内容。`;

      const chapters = splitMdIntoChapters(text);
      expect(chapters.length).toBe(3);
      expect(chapters[0].title).toBe('第一章 开始');
      expect(chapters[1].title).toBe('第一节');
      expect(chapters[2].title).toBe('第二章 发展');
    });

    it('should handle single heading', () => {
      const text = `# 唯一标题
内容`;
      const chapters = splitMdIntoChapters(text);
      expect(chapters.length).toBe(1);
      expect(chapters[0].title).toBe('唯一标题');
    });

    it('should filter out empty chapters', () => {
      const text = `# 标题一

# 标题二
内容`;
      const chapters = splitMdIntoChapters(text);
      expect(chapters.length).toBe(1);
      expect(chapters[0].title).toBe('标题二');
    });
  });
});
