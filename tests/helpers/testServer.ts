import { vi, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import type express from 'express';
import { SCHEMA_SQL, POST_SCHEMA_ALTER_SQL } from '../../server/db/schemaDefinitions.js';

let testDb: Database.Database;

vi.mock('../../server/db/database.js', () => ({
  getDb: () => testDb,
  closeDb: () => {},
}));

vi.mock('../../server/ws/presenceManager.js', () => ({
  generateToken: (userId: string) => `test-token-${userId}`,
  validateToken: (token: string) => {
    const match = token.match(/^test-token-(.+)$/);
    return match ? match[1] : null;
  },
  addConnection: vi.fn(),
  removeConnection: vi.fn(),
  getOnlineUsers: () => [],
  broadcastToProject: vi.fn(),
}));

vi.mock('../../server/services/analyticsService.js', () => ({
  getDashboardData: (projectId: string, days: number) => ({
    summary: { totalWords: 0, totalDays: 0, avgDaily: 0, bestDay: null },
    velocity: [],
    chapterStatus: [{ status: 'draft', count: 0 }],
    streak: { current: 0, longest: 0 },
    target: { target: 0, current: 0, percentage: 0 },
    peakHours: Array.from({ length: 24 }, (_, h) => ({ hour: h, count: 0 })),
  }),
  getCharacterAppearances: async () => [],
}));

vi.mock('../../server/services/fileService.js', () => ({
  readChapter: vi.fn().mockResolvedValue(''),
  writeChapter: vi.fn(),
  writeVersion: vi.fn(),
  readVersion: vi.fn().mockResolvedValue(''),
  deleteVersionFile: vi.fn(),
  deleteVersionDir: vi.fn(),
  ensureProjectDir: vi.fn(),
  deleteProjectDir: vi.fn(),
  deleteChapter: vi.fn(),
}));

function createTestDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA_SQL);
  db.exec(POST_SCHEMA_ALTER_SQL);
  return db;
}

let cachedApp: any;

export function setupTestServer() {
  beforeEach(async () => {
    testDb = createTestDb();
    vi.doMock('../../server/db/database.js', () => ({ getDb: () => testDb, closeDb: () => {} }));
    vi.doMock('../../server/ws/presenceManager.js', () => ({
      generateToken: (uid: string) => `test-token-${uid}`,
      validateToken: (token: string) => { const m = token.match(/^test-token-(.+)$/); return m ? m[1] : null; },
      addConnection: vi.fn(), removeConnection: vi.fn(), getOnlineUsers: () => [], broadcastToProject: vi.fn(),
    }));
    vi.doMock('../../server/services/analyticsService.js', () => ({
      getDashboardData: () => ({ summary: { totalWords: 0, totalDays: 0, avgDaily: 0, bestDay: null }, velocity: [], chapterStatus: [], streak: { current: 0, longest: 0 }, target: { target: 0, current: 0, percentage: 0 }, peakHours: Array.from({ length: 24 }, (_, h) => ({ hour: h, count: 0 })) }),
      getCharacterAppearances: async () => [],
    }));
    vi.doMock('../../server/services/fileService.js', () => ({
      readChapter: vi.fn().mockResolvedValue(''),
      writeChapter: vi.fn(),
      writeVersion: vi.fn(),
      readVersion: vi.fn().mockResolvedValue(''),
      deleteVersionFile: vi.fn(),
      deleteVersionDir: vi.fn(),
      ensureProjectDir: vi.fn(),
      deleteProjectDir: vi.fn(),
      deleteChapter: vi.fn(),
    }));
    const mod = await import('../../server/app.js');
    cachedApp = mod.default;
  });

  afterEach(() => {
    vi.doUnmock('../../server/db/database.js');
    vi.doUnmock('../../server/ws/presenceManager.js');
    vi.doUnmock('../../server/services/analyticsService.js');
    vi.doUnmock('../../server/services/fileService.js');
    vi.restoreAllMocks();
    if (testDb) testDb.close();
    cachedApp = undefined;
  });

  return async () => {
    if (cachedApp) return cachedApp;
    const mod = await import('../../server/app.js');
    return mod.default;
  };
}
