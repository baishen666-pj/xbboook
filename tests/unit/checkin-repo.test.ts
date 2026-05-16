import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';

let memDb: Database.Database;

vi.mock('../../server/db/database.js', () => ({
  getDb: () => memDb,
}));

import * as checkInRepo from '../../server/db/repositories/checkInRepo.js';

function setupTables(): void {
  memDb.exec(`
    CREATE TABLE projects (
      id TEXT PRIMARY KEY, name TEXT NOT NULL,
      status TEXT DEFAULT 'active', sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE check_ins (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, date TEXT NOT NULL,
      words_today INTEGER DEFAULT 0, note TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(project_id, date),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
  `);
}

function seedProject(): string {
  const id = randomUUID();
  memDb.prepare("INSERT INTO projects (id, name) VALUES (?, 'Test Novel')").run(id);
  return id;
}

describe('checkInRepo', () => {
  beforeEach(() => {
    memDb = new Database(':memory:');
    memDb.pragma('foreign_keys = ON');
    setupTables();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (memDb) memDb.close();
  });

  describe('upsert', () => {
    it('创建新打卡记录', () => {
      const projectId = seedProject();

      const result = checkInRepo.upsert({
        projectId,
        date: '2026-05-17',
        wordsToday: 1200,
        note: '今日完成第三章',
      });

      expect(result).toBeDefined();
      expect(result.id).toBeTruthy();
      expect(result.project_id).toBe(projectId);
      expect(result.date).toBe('2026-05-17');
      expect(result.words_today).toBe(1200);
      expect(result.note).toBe('今日完成第三章');
    });

    it('不带备注时 note 为 null', () => {
      const projectId = seedProject();

      const result = checkInRepo.upsert({
        projectId,
        date: '2026-05-17',
        wordsToday: 500,
      });

      expect(result.note).toBeNull();
    });

    it('同一天第二次打卡更新已有记录', () => {
      const projectId = seedProject();

      const first = checkInRepo.upsert({
        projectId,
        date: '2026-05-17',
        wordsToday: 800,
        note: '上午',
      });

      const second = checkInRepo.upsert({
        projectId,
        date: '2026-05-17',
        wordsToday: 1500,
        note: '下午更新',
      });

      expect(second.id).toBe(first.id);
      expect(second.words_today).toBe(1500);
      expect(second.note).toBe('下午更新');
    });

    it('更新时若未传 note 则保留旧值', () => {
      const projectId = seedProject();

      checkInRepo.upsert({
        projectId,
        date: '2026-05-17',
        wordsToday: 800,
        note: '旧备注',
      });

      const updated = checkInRepo.upsert({
        projectId,
        date: '2026-05-17',
        wordsToday: 1200,
      });

      expect(updated.words_today).toBe(1200);
      expect(updated.note).toBe('旧备注');
    });

    it('UNIQUE 约束保证同项目同日期只有一条', () => {
      const projectId = seedProject();

      checkInRepo.upsert({ projectId, date: '2026-05-17', wordsToday: 500 });
      checkInRepo.upsert({ projectId, date: '2026-05-17', wordsToday: 900 });

      const records = checkInRepo.findByProject(projectId);
      expect(records).toHaveLength(1);
    });
  });

  describe('findByProject', () => {
    it('返回项目所有打卡记录按日期降序', () => {
      const projectId = seedProject();

      checkInRepo.upsert({ projectId, date: '2026-05-15', wordsToday: 100 });
      checkInRepo.upsert({ projectId, date: '2026-05-16', wordsToday: 200 });
      checkInRepo.upsert({ projectId, date: '2026-05-17', wordsToday: 300 });

      const results = checkInRepo.findByProject(projectId);

      expect(results).toHaveLength(3);
      expect(results[0].date).toBe('2026-05-17');
      expect(results[1].date).toBe('2026-05-16');
      expect(results[2].date).toBe('2026-05-15');
    });

    it('无打卡记录返回空数组', () => {
      const projectId = seedProject();

      expect(checkInRepo.findByProject(projectId)).toEqual([]);
    });

    it('不同项目互不干扰', () => {
      const p1 = seedProject();
      const p2 = seedProject();

      checkInRepo.upsert({ projectId: p1, date: '2026-05-17', wordsToday: 100 });
      checkInRepo.upsert({ projectId: p2, date: '2026-05-17', wordsToday: 200 });
      checkInRepo.upsert({ projectId: p2, date: '2026-05-16', wordsToday: 150 });

      expect(checkInRepo.findByProject(p1)).toHaveLength(1);
      expect(checkInRepo.findByProject(p2)).toHaveLength(2);
    });
  });

  describe('findByDate', () => {
    it('查找指定日期的打卡记录', () => {
      const projectId = seedProject();
      checkInRepo.upsert({ projectId, date: '2026-05-17', wordsToday: 1200 });

      const result = checkInRepo.findByDate(projectId, '2026-05-17');

      expect(result).toBeDefined();
      expect(result!.words_today).toBe(1200);
    });

    it('不存在时返回 undefined', () => {
      const projectId = seedProject();

      expect(checkInRepo.findByDate(projectId, '2026-05-17')).toBeUndefined();
    });

    it('日期精确匹配，不同日期返回不同结果', () => {
      const projectId = seedProject();
      checkInRepo.upsert({ projectId, date: '2026-05-17', wordsToday: 100 });
      checkInRepo.upsert({ projectId, date: '2026-05-16', wordsToday: 200 });

      const r17 = checkInRepo.findByDate(projectId, '2026-05-17');
      const r16 = checkInRepo.findByDate(projectId, '2026-05-16');

      expect(r17!.words_today).toBe(100);
      expect(r16!.words_today).toBe(200);
    });
  });

  describe('getCalendarData', () => {
    it('返回指定年份的打卡数据按日期升序', () => {
      const projectId = seedProject();

      checkInRepo.upsert({ projectId, date: '2026-01-15', wordsToday: 100 });
      checkInRepo.upsert({ projectId, date: '2026-03-20', wordsToday: 200 });
      checkInRepo.upsert({ projectId, date: '2026-12-01', wordsToday: 300 });
      checkInRepo.upsert({ projectId, date: '2025-12-31', wordsToday: 50 });

      const results = checkInRepo.getCalendarData(projectId, 2026);

      expect(results).toHaveLength(3);
      expect(results[0].date).toBe('2026-01-15');
      expect(results[1].date).toBe('2026-03-20');
      expect(results[2].date).toBe('2026-12-01');
    });

    it('无该年数据返回空数组', () => {
      const projectId = seedProject();
      checkInRepo.upsert({ projectId, date: '2025-06-01', wordsToday: 100 });

      expect(checkInRepo.getCalendarData(projectId, 2026)).toEqual([]);
    });
  });

  describe('getCheckInStats', () => {
    it('无打卡记录时全部为零', () => {
      const projectId = seedProject();

      const stats = checkInRepo.getCheckInStats(projectId);

      expect(stats.totalCheckIns).toBe(0);
      expect(stats.totalWords).toBe(0);
      expect(stats.currentStreak).toBe(0);
      expect(stats.longestStreak).toBe(0);
    });

    it('统计总打卡次数和总字数', () => {
      const projectId = seedProject();

      checkInRepo.upsert({ projectId, date: '2026-05-15', wordsToday: 500 });
      checkInRepo.upsert({ projectId, date: '2026-05-16', wordsToday: 800 });
      checkInRepo.upsert({ projectId, date: '2026-05-17', wordsToday: 1200 });

      const stats = checkInRepo.getCheckInStats(projectId);

      expect(stats.totalCheckIns).toBe(3);
      expect(stats.totalWords).toBe(2500);
    });

    it('计算最长连续打卡天数', () => {
      const projectId = seedProject();

      checkInRepo.upsert({ projectId, date: '2026-05-10', wordsToday: 100 });
      checkInRepo.upsert({ projectId, date: '2026-05-11', wordsToday: 100 });
      checkInRepo.upsert({ projectId, date: '2026-05-12', wordsToday: 100 });
      // 间隔一天
      checkInRepo.upsert({ projectId, date: '2026-05-14', wordsToday: 100 });
      checkInRepo.upsert({ projectId, date: '2026-05-15', wordsToday: 100 });

      const stats = checkInRepo.getCheckInStats(projectId);

      expect(stats.longestStreak).toBe(3);
    });

    it('单日打卡最长连续为1', () => {
      const projectId = seedProject();

      checkInRepo.upsert({ projectId, date: '2026-05-17', wordsToday: 100 });

      const stats = checkInRepo.getCheckInStats(projectId);

      expect(stats.longestStreak).toBe(1);
    });

    it('当前连续打卡天数在日期为今天或昨天时计算', () => {
      const projectId = seedProject();
      const today = new Date().toISOString().slice(0, 10);

      checkInRepo.upsert({ projectId, date: today, wordsToday: 100 });

      const stats = checkInRepo.getCheckInStats(projectId);

      expect(stats.currentStreak).toBeGreaterThanOrEqual(1);
    });
  });
});
