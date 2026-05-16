import { describe, it, expect } from 'vitest';
import { splitTxtIntoChapters, splitMdIntoChapters, splitHtmlIntoChapters } from '../../server/routes/import';

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

    it('should not treat "第N节的内容" as chapter marker', () => {
      const text = `第一章 概述
这是第一节的内容，讲述背景。
这是第二节的内容，讲述发展。

第二章 详解
本章详细说明。`;
      const chapters = splitTxtIntoChapters(text);
      expect(chapters.length).toBe(2);
      expect(chapters[0].title).toContain('第一章');
      expect(chapters[1].title).toContain('第二章');
    });

    it('should split by "第N节" with space after marker', () => {
      const text = `第一节 开端
开端内容。

第二节 发展
发展内容。

第三节 高潮
高潮内容。`;
      const chapters = splitTxtIntoChapters(text);
      expect(chapters.length).toBe(3);
      expect(chapters[0].title).toContain('第一节');
      expect(chapters[1].title).toContain('第二节');
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

  describe('HTML chapter splitting', () => {
    it('should split HTML by <p> tags containing chapter markers', () => {
      const html = '<p>第一章 开始</p>\n<p>这是内容。</p>\n<p>第二章 发展</p>\n<p>更多内容。</p>';
      const chapters = splitHtmlIntoChapters(html);
      expect(chapters.length).toBe(2);
      expect(chapters[0].title).toBe('第一章 开始');
      expect(chapters[1].title).toBe('第二章 发展');
    });

    it('should split HTML by <h1> tags', () => {
      const html = '<h1>第一章 开始</h1>\n<p>内容1</p>\n<h1>第二章 发展</h1>\n<p>内容2</p>';
      const chapters = splitHtmlIntoChapters(html);
      expect(chapters.length).toBe(2);
      expect(chapters[0].title).toBe('第一章 开始');
      expect(chapters[1].title).toBe('第二章 发展');
    });

    it('should preserve HTML formatting in content', () => {
      const html = '<p>第一章</p>\n<p>这是<strong>加粗</strong>和<em>斜体</em>文字。</p>';
      const chapters = splitHtmlIntoChapters(html);
      expect(chapters.length).toBe(1);
      expect(chapters[0].content).toContain('<strong>加粗</strong>');
      expect(chapters[0].content).toContain('<em>斜体</em>');
    });

    it('should return single chapter when no markers found', () => {
      const html = '<p>普通文本内容。</p><p>没有章节标记。</p>';
      const chapters = splitHtmlIntoChapters(html);
      expect(chapters.length).toBe(1);
      expect(chapters[0].title).toBe('第一章');
    });

    it('should return empty array for empty HTML', () => {
      const chapters = splitHtmlIntoChapters('');
      expect(chapters.length).toBe(0);
    });

    it('should handle nested tags in headings', () => {
      const html = '<p><strong>第一章</strong> 开始</p>\n<p>内容</p>\n<p>第二章 发展</p>\n<p>更多内容</p>';
      const chapters = splitHtmlIntoChapters(html);
      expect(chapters.length).toBe(2);
      expect(chapters[0].title).toBe('第一章 开始');
    });
  });
});
