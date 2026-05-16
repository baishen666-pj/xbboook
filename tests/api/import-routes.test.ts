import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import Database from 'better-sqlite3';
import { SCHEMA_SQL } from '../../server/db/schemaDefinitions.js';

let testDb: Database.Database;
let app: any;

function createTestDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA_SQL);
  return db;
}

describe('Import Routes', () => {
  let projectId: string;

  beforeEach(async () => {
    testDb = createTestDb();
    vi.doMock('../../server/db/database.js', () => ({
      getDb: () => testDb,
      closeDb: () => {},
    }));
    vi.doMock('../../server/ws/presenceManager.js', () => ({
      generateToken: (uid: string) => `test-token-${uid}`,
      validateToken: (token: string) => {
        const match = token.match(/^test-token-(.+)$/);
        return match ? match[1] : null;
      },
      addConnection: vi.fn(),
      removeConnection: vi.fn(),
      getOnlineUsers: () => [],
      broadcastToProject: vi.fn(),
    }));
    vi.doMock('../../server/services/analyticsService.js', () => ({
      getDashboardData: () => ({
        summary: { totalWords: 0, totalDays: 0, avgDaily: 0, bestDay: null },
        velocity: [],
        chapterStatus: [],
        streak: { current: 0, longest: 0 },
        target: { target: 0, current: 0, percentage: 0 },
        peakHours: Array.from({ length: 24 }, (_, h) => ({ hour: h, count: 0 })),
      }),
      getCharacterAppearances: async () => [],
    }));
    const chapterContentStore = new Map<string, string>();
    vi.doMock('../../server/services/fileService.js', () => ({
      readChapter: vi.fn(async (pid: string, cid: string) => chapterContentStore.get(`${pid}/${cid}`) ?? ''),
      writeChapter: vi.fn(async (pid: string, cid: string, content: string) => {
        chapterContentStore.set(`${pid}/${cid}`, content);
      }),
      writeVersion: vi.fn(),
      readVersion: vi.fn().mockResolvedValue(''),
      deleteVersionFile: vi.fn(),
      deleteVersionDir: vi.fn(),
      ensureProjectDir: vi.fn(),
      deleteProjectDir: vi.fn(),
      deleteChapter: vi.fn(async (pid: string, cid: string) => {
        chapterContentStore.delete(`${pid}/${cid}`);
      }),
    }));
    const mod = await import('../../server/app.js');
    app = mod.default;

    const res = await request(app).post('/api/projects').send({ name: 'Import Test Novel' });
    projectId = res.body.data.id;
  });

  afterEach(() => {
    vi.doUnmock('../../server/db/database.js');
    vi.doUnmock('../../server/ws/presenceManager.js');
    vi.doUnmock('../../server/services/analyticsService.js');
    vi.doUnmock('../../server/services/fileService.js');
    vi.restoreAllMocks();
    if (testDb) testDb.close();
  });

  describe('POST /api/projects/:projectId/import - TXT files', () => {
    it('should import a TXT file with Chinese chapter markers', async () => {
      const content = [
        '第一章 开始',
        '这是第一章的内容，讲述主角的起源。',
        '',
        '第二章 发展',
        '这是第二章的内容，故事开始展开。',
        '',
        '第三章 高潮',
        '这是第三章的内容，冲突达到顶点。',
      ].join('\n');

      const res = await request(app)
        .post(`/api/projects/${projectId}/import`)
        .attach('file', Buffer.from(content, 'utf-8'), 'novel.txt');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.imported).toBe(3);
      expect(res.body.data.chapters).toHaveLength(3);
      expect(res.body.data.chapters[0].title).toContain('第一章');
      expect(res.body.data.chapters[1].title).toContain('第二章');
      expect(res.body.data.chapters[2].title).toContain('第三章');
      expect(res.body.data.chapters[0].words).toBeGreaterThan(0);
    });

    it('should import a TXT file with English "Chapter N" markers', async () => {
      const content = [
        'Chapter 1 The Beginning',
        'Content of the first chapter.',
        '',
        'Chapter 2 The Journey',
        'Content of the second chapter.',
      ].join('\n');

      const res = await request(app)
        .post(`/api/projects/${projectId}/import`)
        .attach('file', Buffer.from(content, 'utf-8'), 'novel.txt');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.imported).toBe(2);
      expect(res.body.data.chapters[0].title).toContain('Chapter 1');
      expect(res.body.data.chapters[1].title).toContain('Chapter 2');
    });

    it('should import a TXT file without chapter markers as a single chapter', async () => {
      const content = 'This is a plain text file with no chapter markers at all.';

      const res = await request(app)
        .post(`/api/projects/${projectId}/import`)
        .attach('file', Buffer.from(content, 'utf-8'), 'plain.txt');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.imported).toBe(1);
      expect(res.body.data.chapters[0].title).toBe('第一章');
    });

    it('should reject an empty TXT file', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/import`)
        .attach('file', Buffer.from('', 'utf-8'), 'empty.txt');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('空');
    });

    it('should reject a whitespace-only TXT file', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/import`)
        .attach('file', Buffer.from('   \n  \n  ', 'utf-8'), 'whitespace.txt');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/projects/:projectId/import - MD files', () => {
    it('should import a Markdown file split by headings', async () => {
      const content = [
        '# 第一章 开始',
        '这是第一章的内容。',
        '',
        '## 第一节 细节',
        '第一节的详细内容。',
        '',
        '# 第二章 发展',
        '这是第二章的内容。',
      ].join('\n');

      const res = await request(app)
        .post(`/api/projects/${projectId}/import`)
        .attach('file', Buffer.from(content, 'utf-8'), 'novel.md');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.imported).toBe(3);
      expect(res.body.data.chapters[0].title).toBe('第一章 开始');
      expect(res.body.data.chapters[1].title).toBe('第一节 细节');
      expect(res.body.data.chapters[2].title).toBe('第二章 发展');
    });

    it('should import a Markdown file with a single heading', async () => {
      const content = [
        '# Only Chapter',
        'The only content in this file.',
      ].join('\n');

      const res = await request(app)
        .post(`/api/projects/${projectId}/import`)
        .attach('file', Buffer.from(content, 'utf-8'), 'single.md');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.imported).toBe(1);
      expect(res.body.data.chapters[0].title).toBe('Only Chapter');
    });

    it('should skip empty sections between headings in Markdown', async () => {
      const content = [
        '# Title One',
        '',
        '# Title Two',
        'Actual content here.',
      ].join('\n');

      const res = await request(app)
        .post(`/api/projects/${projectId}/import`)
        .attach('file', Buffer.from(content, 'utf-8'), 'skip-empty.md');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.imported).toBe(1);
      expect(res.body.data.chapters[0].title).toBe('Title Two');
    });

    it('should reject an empty Markdown file', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/import`)
        .attach('file', Buffer.from('', 'utf-8'), 'empty.md');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should handle Markdown with level-3 headings', async () => {
      const content = [
        '### Scene A',
        'Scene A content.',
        '',
        '### Scene B',
        'Scene B content.',
      ].join('\n');

      const res = await request(app)
        .post(`/api/projects/${projectId}/import`)
        .attach('file', Buffer.from(content, 'utf-8'), 'scenes.md');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.imported).toBe(2);
      expect(res.body.data.chapters[0].title).toBe('Scene A');
      expect(res.body.data.chapters[1].title).toBe('Scene B');
    });
  });

  describe('POST /api/projects/:projectId/import - DOCX files', () => {
    it('should reject a DOCX file when mammoth fails to parse invalid buffer', async () => {
      // Sending a non-ZIP buffer as .docx causes mammoth/jszip to throw
      const fakeDocx = Buffer.from('not-a-real-docx-file', 'utf-8');

      const res = await request(app)
        .post(`/api/projects/${projectId}/import`)
        .attach('file', fakeDocx, 'document.docx');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });

    it('should reject an empty DOCX file buffer', async () => {
      const fakeDocx = Buffer.from('', 'utf-8');

      const res = await request(app)
        .post(`/api/projects/${projectId}/import`)
        .attach('file', fakeDocx, 'empty.docx');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/projects/:projectId/import - unsupported formats', () => {
    it('should reject a PDF file', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/import`)
        .attach('file', Buffer.from('fake pdf', 'utf-8'), 'document.pdf');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('不支持');
      expect(res.body.error).toContain('.pdf');
    });

    it('should reject an RTF file', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/import`)
        .attach('file', Buffer.from('{\\rtf1}', 'utf-8'), 'document.rtf');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('不支持');
    });

    it('should reject a file with no extension', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/import`)
        .attach('file', Buffer.from('some text', 'utf-8'), 'noextension');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/projects/:projectId/import - missing file', () => {
    it('should return 400 when no file is uploaded', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/import`)
        .field('projectId', projectId);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('选择文件');
    });
  });

  describe('POST /api/projects/:projectId/import - created chapters are persisted', () => {
    it('should create chapters in the database that appear in chapter list', async () => {
      const content = [
        '第一章 晨曦',
        '清晨的阳光洒在大地上。',
        '',
        '第二章 旅途',
        '主角踏上了冒险之旅。',
      ].join('\n');

      const importRes = await request(app)
        .post(`/api/projects/${projectId}/import`)
        .attach('file', Buffer.from(content, 'utf-8'), 'persist.txt');

      expect(importRes.status).toBe(200);

      const listRes = await request(app)
        .get(`/api/projects/${projectId}/chapters`);

      expect(listRes.status).toBe(200);
      expect(listRes.body.data.length).toBeGreaterThanOrEqual(2);

      const titles = listRes.body.data.map((ch: any) => ch.title);
      expect(titles.some((t: string) => t.includes('晨曦'))).toBe(true);
      expect(titles.some((t: string) => t.includes('旅途'))).toBe(true);
    });

    it('should truncate chapter titles to 200 characters', async () => {
      const longTitle = '第' + '一'.repeat(250) + '章';
      const content = longTitle + '\nSome content here.';

      const res = await request(app)
        .post(`/api/projects/${projectId}/import`)
        .attach('file', Buffer.from(content, 'utf-8'), 'long-title.txt');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      // The stored title is truncated to 200 chars in the route handler
      // but the response returns the original title from the split
      // Verify the DB entry is truncated
      const listRes = await request(app)
        .get(`/api/projects/${projectId}/chapters`);
      const storedTitle = listRes.body.data[0].title;
      expect(storedTitle.length).toBeLessThanOrEqual(200);
    });
  });

  describe('POST /api/projects/:projectId/import - non-existent project', () => {
    it('should return 500 when importing into a non-existent project', async () => {
      const fakeProjectId = 'non-existent-project-id';
      const content = 'Some text content for import.';

      const res = await request(app)
        .post(`/api/projects/${fakeProjectId}/import`)
        .attach('file', Buffer.from(content, 'utf-8'), 'test.txt');

      // The route will try to create a chapter for a project that does not exist,
      // which will fail due to foreign key constraints
      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/projects/:projectId/import - mixed content edge cases', () => {
    it('should handle a TXT file with only one chapter marker and no content after it', async () => {
      // Only one chapter marker found (need >= 2 for pattern match),
      // so it falls back to single-chapter treatment
      const content = '第一章 孤独的标题';

      const res = await request(app)
        .post(`/api/projects/${projectId}/import`)
        .attach('file', Buffer.from(content, 'utf-8'), 'single-marker.txt');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.imported).toBe(1);
    });

    it('should handle a Markdown file with no headings', async () => {
      const content = 'Just some plain text without any headings at all.';

      const res = await request(app)
        .post(`/api/projects/${projectId}/import`)
        .attach('file', Buffer.from(content, 'utf-8'), 'no-headings.md');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.imported).toBe(1);
      expect(res.body.data.chapters[0].title).toBe('第一章');
    });

    it('should handle a Markdown file with only whitespace between headings', async () => {
      const content = [
        '# Title A',
        '   ',
        '\t',
        '# Title B',
        'Content for B.',
      ].join('\n');

      const res = await request(app)
        .post(`/api/projects/${projectId}/import`)
        .attach('file', Buffer.from(content, 'utf-8'), 'whitespace-sections.md');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      // Title A section has only whitespace lines, should be skipped
      expect(res.body.data.imported).toBe(1);
      expect(res.body.data.chapters[0].title).toBe('Title B');
    });

    it('should handle a TXT file with "第X节" markers', async () => {
      const content = [
        '第一节 开端',
        '这是开端的文字描述。',
        '',
        '第二节 发展',
        '这是发展的文字描述。',
        '',
        '第三节 结局',
        '这是结局的文字描述。',
      ].join('\n');

      const res = await request(app)
        .post(`/api/projects/${projectId}/import`)
        .attach('file', Buffer.from(content, 'utf-8'), 'sections.txt');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.imported).toBe(3);
    });

    it('should not treat "第N节的内容" in text as a chapter marker', async () => {
      const content = [
        '第一章 概述',
        '这是第一节的内容，讲述背景。',
        '这是第二节的内容，讲述发展。',
        '',
        '第二章 详解',
        '本章详细说明各方面内容。',
      ].join('\n');

      const res = await request(app)
        .post(`/api/projects/${projectId}/import`)
        .attach('file', Buffer.from(content, 'utf-8'), 'no-false-match.txt');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.imported).toBe(2);
    });

    it('should handle a TXT file with "第X回" markers', async () => {
      // Note: content lines must not contain "第...回" patterns to avoid false matches.
      const content = [
        '第一回 甄士隐梦幻识通灵',
        '甄士隐的故事从这里开始。',
        '',
        '第二回 贾夫人仙逝扬州城',
        '贾夫人的故事由此展开。',
      ].join('\n');

      const res = await request(app)
        .post(`/api/projects/${projectId}/import`)
        .attach('file', Buffer.from(content, 'utf-8'), 'huiben.txt');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.imported).toBe(2);
    });

    it('should handle a file with uppercase "CHAPTER" markers', async () => {
      const content = [
        'CHAPTER 1 The Start',
        'First chapter content.',
        '',
        'CHAPTER 2 The End',
        'Second chapter content.',
      ].join('\n');

      const res = await request(app)
        .post(`/api/projects/${projectId}/import`)
        .attach('file', Buffer.from(content, 'utf-8'), 'uppercase.txt');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.imported).toBe(2);
    });
  });

  describe('POST /api/projects/:projectId/import - multiple sequential imports', () => {
    it('should accumulate chapters across multiple imports', async () => {
      const content1 = '第一章 首次导入\n首次导入的内容。';
      const content2 = '第一章 再次导入\n再次导入的内容。';

      const res1 = await request(app)
        .post(`/api/projects/${projectId}/import`)
        .attach('file', Buffer.from(content1, 'utf-8'), 'first.txt');
      expect(res1.status).toBe(200);
      expect(res1.body.data.imported).toBe(1);

      const res2 = await request(app)
        .post(`/api/projects/${projectId}/import`)
        .attach('file', Buffer.from(content2, 'utf-8'), 'second.txt');
      expect(res2.status).toBe(200);
      expect(res2.body.data.imported).toBe(1);

      const listRes = await request(app)
        .get(`/api/projects/${projectId}/chapters`);

      expect(listRes.body.data.length).toBeGreaterThanOrEqual(2);
    });
  });
});
