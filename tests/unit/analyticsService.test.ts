import { describe, it, expect, vi, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import path from 'path';
import fs from 'fs/promises';

let memDb: Database.Database;

vi.mock('../../server/db/database.js', () => ({
  getDb: () => memDb,
}));

import * as statsRepo from '../../server/db/repositories/statsRepo.js';
import * as sessionRepo from '../../server/db/repositories/sessionRepo.js';

vi.mock('../../server/db/repositories/statsRepo.js', () => ({
  getSummary: vi.fn().mockReturnValue({ totalWords: 0, totalDays: 0, avgDaily: 0, bestDay: null }),
  getChapterStatusDistribution: vi.fn().mockReturnValue([]),
  getWritingStreak: vi.fn().mockReturnValue({ current: 0, longest: 0 }),
  getTargetProgress: vi.fn().mockReturnValue({ target: 0, current: 0, percentage: 0 }),
}));

vi.mock('../../server/db/repositories/sessionRepo.js', () => ({
  getDailyWritingStats: vi.fn().mockReturnValue([]),
  getHourlyDistribution: vi.fn().mockReturnValue([]),
}));

// Mock fs for getCharacterAppearances
vi.mock('fs/promises', () => ({
  default: {
    readdir: vi.fn().mockResolvedValue([]),
    readFile: vi.fn(),
  },
  readdir: vi.fn().mockResolvedValue([]),
  readFile: vi.fn(),
}));

vi.mock('fs', () => ({
  existsSync: vi.fn().mockReturnValue(false),
}));

vi.mock('path', () => {
  const pathMock = {
    resolve: (...args: string[]) => args.join('/'),
    join: (...args: string[]) => args.join('/'),
  };
  return {
    default: pathMock,
    ...pathMock,
  };
});

// Import the service under test AFTER mocks
import * as analyticsService from '../../server/services/analyticsService.js';

describe('analyticsService', () => {
  beforeEach(() => {
    memDb = new Database(':memory:');
    vi.clearAllMocks();
  });

  describe('getDashboardData', () => {
    it('aggregates all dashboard components', () => {
      vi.mocked(statsRepo.getSummary).mockReturnValue({
        totalWords: 10000, totalDays: 5, avgDaily: 2000,
        bestDay: { date: '2026-01-10', words: 3000 },
      });
      vi.mocked(sessionRepo.getDailyWritingStats).mockReturnValue([
        { date: '2026-01-10', words: 3000, sessions: 2 },
      ]);
      vi.mocked(statsRepo.getChapterStatusDistribution).mockReturnValue([
        { status: 'draft', count: 5 }, { status: 'done', count: 3 },
      ]);
      vi.mocked(statsRepo.getWritingStreak).mockReturnValue({ current: 3, longest: 7 });
      vi.mocked(statsRepo.getTargetProgress).mockReturnValue({ target: 100000, current: 10000, percentage: 10 });
      vi.mocked(sessionRepo.getHourlyDistribution).mockReturnValue(
        Array.from({ length: 24 }, (_, i) => ({ hour: i, count: i === 10 ? 5 : 0 })),
      );

      const result = analyticsService.getDashboardData('p1', 30);

      expect(result.summary.totalWords).toBe(10000);
      expect(result.summary.bestDay!.words).toBe(3000);
      expect(result.velocity).toHaveLength(1);
      expect(result.chapterStatus).toHaveLength(2);
      expect(result.streak).toEqual({ current: 3, longest: 7 });
      expect(result.target.percentage).toBe(10);
      expect(result.peakHours).toHaveLength(24);
      expect(result.peakHours[10].count).toBe(5);
    });

    it('passes days parameter to sub-functions', () => {
      analyticsService.getDashboardData('p1', 7);

      expect(sessionRepo.getDailyWritingStats).toHaveBeenCalledWith('p1', 7);
      expect(sessionRepo.getHourlyDistribution).toHaveBeenCalledWith('p1', 7);
    });

    it('defaults to 30 days', () => {
      analyticsService.getDashboardData('p1');

      expect(sessionRepo.getDailyWritingStats).toHaveBeenCalledWith('p1', 30);
      expect(sessionRepo.getHourlyDistribution).toHaveBeenCalledWith('p1', 30);
    });
  });

  describe('getCharacterAppearances', () => {
    it('returns empty array when no characters', async () => {
      // Setup in-memory DB with no characters
      memDb.exec("CREATE TABLE characters (id TEXT PRIMARY KEY, project_id TEXT, name TEXT, sort_order INTEGER DEFAULT 0)");
      const result = await analyticsService.getCharacterAppearances('p1');
      expect(result).toEqual([]);
    });

    it('returns empty when characters exist but chapter directory missing', async () => {
      memDb.exec("CREATE TABLE characters (id TEXT PRIMARY KEY, project_id TEXT, name TEXT, sort_order INTEGER DEFAULT 0)");
      memDb.prepare("INSERT INTO characters (id, project_id, name, sort_order) VALUES (?, ?, ?, 0)")
        .run('c1', 'p1', 'Alice');

      const { existsSync } = await import('fs');
      vi.mocked(existsSync).mockReturnValue(false);

      const result = await analyticsService.getCharacterAppearances('p1');
      expect(result).toEqual([]);
    });

    it('counts character name occurrences across chapter files', async () => {
      memDb.exec("CREATE TABLE characters (id TEXT PRIMARY KEY, project_id TEXT, name TEXT, sort_order INTEGER DEFAULT 0)");
      memDb.prepare("INSERT INTO characters (id, project_id, name, sort_order) VALUES (?, ?, ?, 0)")
        .run('c1', 'p1', 'Alice');
      memDb.prepare("INSERT INTO characters (id, project_id, name, sort_order) VALUES (?, ?, ?, 1)")
        .run('c2', 'p1', 'Bob');

      const { existsSync } = await import('fs');
      vi.mocked(existsSync).mockReturnValue(true);

      const { default: fsMock } = await import('fs/promises');
      vi.mocked(fsMock.readdir).mockResolvedValue(['ch1.md', 'ch2.md'] as unknown as fs.Dirent[]);
      vi.mocked(fsMock.readFile)
        .mockResolvedValueOnce('Alice went to the market. Alice bought apples.' as any)
        .mockResolvedValueOnce('Bob met Alice at the store.' as any);

      const result = await analyticsService.getCharacterAppearances('p1');

      expect(result).toHaveLength(2);
      const alice = result.find(r => r.name === 'Alice');
      const bob = result.find(r => r.name === 'Bob');
      expect(alice!.count).toBe(3); // 2 in ch1 + 1 in ch2
      expect(bob!.count).toBe(1);
    });

    it('filters out characters with zero appearances', async () => {
      memDb.exec("CREATE TABLE characters (id TEXT PRIMARY KEY, project_id TEXT, name TEXT, sort_order INTEGER DEFAULT 0)");
      memDb.prepare("INSERT INTO characters (id, project_id, name, sort_order) VALUES (?, ?, ?, 0)")
        .run('c1', 'p1', 'Alice');
      memDb.prepare("INSERT INTO characters (id, project_id, name, sort_order) VALUES (?, ?, ?, 1)")
        .run('c2', 'p1', 'NeverMentioned');

      const { existsSync } = await import('fs');
      vi.mocked(existsSync).mockReturnValue(true);

      const { default: fsMock } = await import('fs/promises');
      vi.mocked(fsMock.readdir).mockResolvedValue(['ch1.md'] as unknown as fs.Dirent[]);
      vi.mocked(fsMock.readFile).mockResolvedValue('Alice appears here.' ) as any;

      const result = await analyticsService.getCharacterAppearances('p1');

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Alice');
    });

    it('skips non-markdown files', async () => {
      memDb.exec("CREATE TABLE characters (id TEXT PRIMARY KEY, project_id TEXT, name TEXT, sort_order INTEGER DEFAULT 0)");
      memDb.prepare("INSERT INTO characters (id, project_id, name, sort_order) VALUES (?, ?, ?, 0)")
        .run('c1', 'p1', 'Alice');

      const { existsSync } = await import('fs');
      vi.mocked(existsSync).mockReturnValue(true);

      const { default: fsMock } = await import('fs/promises');
      vi.mocked(fsMock.readdir).mockResolvedValue(['notes.txt', 'image.png', 'ch1.md'] as unknown as fs.Dirent[]);
      vi.mocked(fsMock.readFile).mockResolvedValue('Alice is here') as any;

      await analyticsService.getCharacterAppearances('p1');

      // readFile should only be called once (for ch1.md)
      expect(fsMock.readFile).toHaveBeenCalledTimes(1);
    });

    it('sorts results by count descending', async () => {
      memDb.exec("CREATE TABLE characters (id TEXT PRIMARY KEY, project_id TEXT, name TEXT, sort_order INTEGER DEFAULT 0)");
      memDb.prepare("INSERT INTO characters (id, project_id, name, sort_order) VALUES (?, ?, ?, 0)")
        .run('c1', 'p1', 'Minor');
      memDb.prepare("INSERT INTO characters (id, project_id, name, sort_order) VALUES (?, ?, ?, 1)")
        .run('c2', 'p1', 'Major');

      const { existsSync } = await import('fs');
      vi.mocked(existsSync).mockReturnValue(true);

      const { default: fsMock } = await import('fs/promises');
      vi.mocked(fsMock.readdir).mockResolvedValue(['ch1.md'] as unknown as fs.Dirent[]);
      vi.mocked(fsMock.readFile).mockResolvedValue('Major Major Minor') as any;

      const result = await analyticsService.getCharacterAppearances('p1');

      expect(result[0].name).toBe('Major');
      expect(result[0].count).toBe(2);
      expect(result[1].name).toBe('Minor');
      expect(result[1].count).toBe(1);
    });
  });
});
