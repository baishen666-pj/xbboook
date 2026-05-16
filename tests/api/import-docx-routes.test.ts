import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import Database from 'better-sqlite3';
import { SCHEMA_SQL } from '../../server/db/schemaDefinitions.js';

let testDb: Database.Database;
let docxApp: any;

const mockConvertToHtml = vi.fn().mockResolvedValue({
  value: '<p>第一章 开始</p>\n<p>这是第一章内容。</p>\n<p>第二章 发展</p>\n<p>这是第二章内容。</p>',
  messages: [],
});

function createTestDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA_SQL);
  return db;
}

describe('Import Routes - DOCX with mocked mammoth', () => {
  let projectId: string;

  beforeEach(async () => {
    testDb = createTestDb();
    mockConvertToHtml.mockReset();
    mockConvertToHtml.mockResolvedValue({
      value: '<p>第一章 开始</p>\n<p>这是第一章内容。</p>\n<p>第二章 发展</p>\n<p>这是第二章内容。</p>',
      messages: [],
    });
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
    vi.doMock('mammoth', () => ({
      default: { convertToHtml: mockConvertToHtml },
      convertToHtml: mockConvertToHtml,
    }));

    const mod = await import('../../server/app.js');
    docxApp = mod.default;

    const res = await request(docxApp).post('/api/projects').send({ name: 'DOCX Import Test' });
    projectId = res.body.data.id;
  });

  afterEach(() => {
    vi.doUnmock('../../server/db/database.js');
    vi.doUnmock('../../server/ws/presenceManager.js');
    vi.doUnmock('../../server/services/analyticsService.js');
    vi.doUnmock('../../server/services/fileService.js');
    vi.doUnmock('mammoth');
    vi.restoreAllMocks();
    if (testDb) testDb.close();
  });

  it('should import a DOCX file by converting to HTML and splitting chapters', async () => {
    const fakeDocx = Buffer.from('PKfake-docx-content', 'utf-8');

    const res = await request(docxApp)
      .post(`/api/projects/${projectId}/import`)
      .attach('file', fakeDocx, 'document.docx');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.imported).toBe(2);
    expect(res.body.data.chapters[0].title).toContain('第一章');
    expect(res.body.data.chapters[1].title).toContain('第二章');
  });

  it('should preserve HTML formatting in chapter content', async () => {
    mockConvertToHtml.mockResolvedValueOnce({
      value: '<p>第一章 测试</p>\n<p>这是<strong>加粗</strong>和<em>斜体</em>文字。</p>\n<p>第二章 继续</p>\n<p>更多内容。</p>',
      messages: [],
    });

    const fakeDocx = Buffer.from('PKfake', 'utf-8');
    const res = await request(docxApp)
      .post(`/api/projects/${projectId}/import`)
      .attach('file', fakeDocx, 'styled.docx');

    expect(res.status).toBe(200);
    expect(res.body.data.chapters[0].title).toBe('第一章 测试');
    expect(res.body.data.chapters[0].words).toBeGreaterThan(0);
  });

  it('should return warnings from mammoth', async () => {
    mockConvertToHtml.mockResolvedValueOnce({
      value: '<p>第一章</p><p>内容</p>',
      messages: [
        { type: 'warning', message: 'Unrecognised style: custom' },
        { type: 'warning', message: 'Image skipped: unsupported format' },
      ],
    });

    const fakeDocx = Buffer.from('PKfake', 'utf-8');
    const res = await request(docxApp)
      .post(`/api/projects/${projectId}/import`)
      .attach('file', fakeDocx, 'warn.docx');

    expect(res.status).toBe(200);
    expect(res.body.warnings).toHaveLength(2);
    expect(res.body.warnings[0]).toContain('Unrecognised style');
  });

  it('should not include warnings field when there are none', async () => {
    mockConvertToHtml.mockResolvedValueOnce({
      value: '<p>第一章</p><p>内容</p>',
      messages: [],
    });

    const fakeDocx = Buffer.from('PKfake', 'utf-8');
    const res = await request(docxApp)
      .post(`/api/projects/${projectId}/import`)
      .attach('file', fakeDocx, 'clean.docx');

    expect(res.status).toBe(200);
    expect(res.body.warnings).toBeUndefined();
  });

  it('should reject a DOCX file that converts to empty HTML', async () => {
    mockConvertToHtml.mockResolvedValueOnce({ value: '', messages: [] });

    const fakeDocx = Buffer.from('PKfake', 'utf-8');

    const res = await request(docxApp)
      .post(`/api/projects/${projectId}/import`)
      .attach('file', fakeDocx, 'empty.docx');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('should handle mammoth conversion errors', async () => {
    mockConvertToHtml.mockRejectedValueOnce(new Error('Corrupt DOCX file'));

    const fakeDocx = Buffer.from('PKcorrupt', 'utf-8');

    const res = await request(docxApp)
      .post(`/api/projects/${projectId}/import`)
      .attach('file', fakeDocx, 'corrupt.docx');

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('Corrupt DOCX file');
  });

  it('should handle DOCX import with no chapter markers (single chapter)', async () => {
    mockConvertToHtml.mockResolvedValueOnce({
      value: '<p>This is plain text from a DOCX without any chapter markers.</p>',
      messages: [],
    });

    const fakeDocx = Buffer.from('PKfake', 'utf-8');

    const res = await request(docxApp)
      .post(`/api/projects/${projectId}/import`)
      .attach('file', fakeDocx, 'plain.docx');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.imported).toBe(1);
    expect(res.body.data.chapters[0].title).toBe('第一章');
  });

  it('should split HTML chapters using heading tags', async () => {
    mockConvertToHtml.mockResolvedValueOnce({
      value: '<h1>第一章 开始</h1>\n<p>内容1</p>\n<h1>第二章 发展</h1>\n<p>内容2</p>',
      messages: [],
    });

    const fakeDocx = Buffer.from('PKfake', 'utf-8');
    const res = await request(docxApp)
      .post(`/api/projects/${projectId}/import`)
      .attach('file', fakeDocx, 'headings.docx');

    expect(res.status).toBe(200);
    expect(res.body.data.imported).toBe(2);
    expect(res.body.data.chapters[0].title).toBe('第一章 开始');
    expect(res.body.data.chapters[1].title).toBe('第二章 发展');
  });
});
