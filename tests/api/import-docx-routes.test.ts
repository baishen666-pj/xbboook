import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import Database from 'better-sqlite3';
import { SCHEMA_SQL } from '../../server/db/schemaDefinitions.js';

let testDb: Database.Database;
let docxApp: any;

const mockExtractRawText = vi.fn().mockResolvedValue({
  value: '第一章 开始\n这是第一章内容。\n\n第二章 发展\n这是第二章内容。',
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
    mockExtractRawText.mockReset();
    mockExtractRawText.mockResolvedValue({
      value: '第一章 开始\n这是第一章内容。\n\n第二章 发展\n这是第二章内容。',
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
      default: { extractRawText: mockExtractRawText },
      extractRawText: mockExtractRawText,
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

  it('should import a DOCX file by extracting text and splitting chapters', async () => {
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

  it('should reject a DOCX file that extracts empty text', async () => {
    mockExtractRawText.mockResolvedValueOnce({ value: '' });

    const fakeDocx = Buffer.from('PKfake', 'utf-8');

    const res = await request(docxApp)
      .post(`/api/projects/${projectId}/import`)
      .attach('file', fakeDocx, 'empty.docx');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('should handle mammoth extraction errors', async () => {
    mockExtractRawText.mockRejectedValueOnce(new Error('Corrupt DOCX file'));

    const fakeDocx = Buffer.from('PKcorrupt', 'utf-8');

    const res = await request(docxApp)
      .post(`/api/projects/${projectId}/import`)
      .attach('file', fakeDocx, 'corrupt.docx');

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('Corrupt DOCX file');
  });

  it('should handle DOCX import with no chapter markers (single chapter)', async () => {
    mockExtractRawText.mockResolvedValueOnce({
      value: 'This is plain text from a DOCX without any chapter markers.',
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
});