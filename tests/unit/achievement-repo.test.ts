import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';

let memDb: Database.Database;

vi.mock('../../server/db/database.js', () => ({
  getDb: () => memDb,
}));

import * as achievementRepo from '../../server/db/repositories/achievementRepo.js';

function setupTables(): void {
  memDb.exec(`
    CREATE TABLE projects (
      id TEXT PRIMARY KEY, name TEXT NOT NULL,
      status TEXT DEFAULT 'active', sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE achievements (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, badge_type TEXT NOT NULL,
      earned_at TEXT DEFAULT (datetime('now')), metadata TEXT,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
    CREATE UNIQUE INDEX idx_achievements_project_badge ON achievements(project_id, badge_type);
  `);
}

function seedProject(): string {
  const id = randomUUID();
  memDb.prepare("INSERT INTO projects (id, name) VALUES (?, 'Test Novel')").run(id);
  return id;
}

describe('achievementRepo', () => {
  beforeEach(() => {
    memDb = new Database(':memory:');
    memDb.pragma('foreign_keys = ON');
    setupTables();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (memDb) memDb.close();
  });

  describe('earn', () => {
    it('颁发新成就并返回记录', () => {
      const projectId = seedProject();

      const result = achievementRepo.earn(projectId, 'first_chapter');

      expect(result).toBeDefined();
      expect(result!.id).toBeTruthy();
      expect(result!.project_id).toBe(projectId);
      expect(result!.badge_type).toBe('first_chapter');
      expect(result!.earned_at).toBeTruthy();
      expect(result!.metadata).toBeNull();
    });

    it('带元数据颁发成就', () => {
      const projectId = seedProject();

      const result = achievementRepo.earn(projectId, 'words_1k', { chapterTitle: '第一章' });

      expect(result).toBeDefined();
      expect(result!.metadata).toBe(JSON.stringify({ chapterTitle: '第一章' }));
    });

    it('同一项目同一类型不可重复颁发', () => {
      const projectId = seedProject();

      const first = achievementRepo.earn(projectId, 'first_chapter');
      const second = achievementRepo.earn(projectId, 'first_chapter');

      expect(first).toBeDefined();
      expect(second).toBeNull();
    });

    it('同一项目不同类型可分别颁发', () => {
      const projectId = seedProject();

      const a1 = achievementRepo.earn(projectId, 'first_chapter');
      const a2 = achievementRepo.earn(projectId, 'words_1k');

      expect(a1).toBeDefined();
      expect(a2).toBeDefined();
      expect(a1!.id).not.toBe(a2!.id);
    });

    it('不同项目可颁发相同类型', () => {
      const p1 = seedProject();
      const p2 = seedProject();

      const a1 = achievementRepo.earn(p1, 'first_chapter');
      const a2 = achievementRepo.earn(p2, 'first_chapter');

      expect(a1).toBeDefined();
      expect(a2).toBeDefined();
    });
  });

  describe('findByProject', () => {
    it('返回项目所有成就按时间降序', () => {
      const projectId = seedProject();
      achievementRepo.earn(projectId, 'first_chapter');
      achievementRepo.earn(projectId, 'words_1k');
      achievementRepo.earn(projectId, 'streak_7');

      const results = achievementRepo.findByProject(projectId);

      expect(results).toHaveLength(3);
      // 降序排列：最新在前
      expect(results[0].earned_at >= results[1].earned_at).toBe(true);
    });

    it('无成就时返回空数组', () => {
      const projectId = seedProject();

      expect(achievementRepo.findByProject(projectId)).toEqual([]);
    });

    it('不同项目的成就互不干扰', () => {
      const p1 = seedProject();
      const p2 = seedProject();
      achievementRepo.earn(p1, 'first_chapter');
      achievementRepo.earn(p2, 'words_1k');
      achievementRepo.earn(p2, 'streak_7');

      expect(achievementRepo.findByProject(p1)).toHaveLength(1);
      expect(achievementRepo.findByProject(p2)).toHaveLength(2);
    });
  });

  describe('hasBadge', () => {
    it('已颁发返回 true', () => {
      const projectId = seedProject();
      achievementRepo.earn(projectId, 'first_chapter');

      expect(achievementRepo.hasBadge(projectId, 'first_chapter')).toBe(true);
    });

    it('未颁发返回 false', () => {
      const projectId = seedProject();

      expect(achievementRepo.hasBadge(projectId, 'first_chapter')).toBe(false);
    });
  });

  describe('checkAndAward', () => {
    it('达到章节门槛时颁发对应徽章', () => {
      const projectId = seedProject();

      const awarded = achievementRepo.checkAndAward(projectId, { chapterCount: 1 });

      expect(awarded.length).toBeGreaterThanOrEqual(1);
      const types = awarded.map((a) => a.badge_type);
      expect(types).toContain('first_chapter');
    });

    it('达到多个门槛同时颁发多个徽章', () => {
      const projectId = seedProject();

      const awarded = achievementRepo.checkAndAward(projectId, {
        totalWords: 15000,
        chapterCount: 12,
        checkInCount: 5,
        currentStreak: 8,
      });

      const types = awarded.map((a) => a.badge_type);
      expect(types).toContain('first_chapter');
      expect(types).toContain('words_1k');
      expect(types).toContain('words_10k');
      expect(types).toContain('chapters_10');
      expect(types).toContain('streak_7');
      expect(types).toContain('checkin_first');
    });

    it('未达到任何门槛时返回空数组', () => {
      const projectId = seedProject();

      const awarded = achievementRepo.checkAndAward(projectId, {
        totalWords: 0,
        chapterCount: 0,
        checkInCount: 0,
        currentStreak: 0,
      });

      expect(awarded).toEqual([]);
    });

    it('不重复颁发已有徽章', () => {
      const projectId = seedProject();

      achievementRepo.checkAndAward(projectId, { chapterCount: 1 });
      const second = achievementRepo.checkAndAward(projectId, { chapterCount: 1 });

      expect(second).toEqual([]);
    });

    it('达到万字先锋门槛但不达到五万门槛', () => {
      const projectId = seedProject();

      const awarded = achievementRepo.checkAndAward(projectId, { totalWords: 12000 });
      const types = awarded.map((a) => a.badge_type);

      expect(types).toContain('words_1k');
      expect(types).toContain('words_10k');
      expect(types).not.toContain('words_50k');
    });

    it('达到最高级别万字200k门槛', () => {
      const projectId = seedProject();

      const awarded = achievementRepo.checkAndAward(projectId, { totalWords: 250000 });
      const types = awarded.map((a) => a.badge_type);

      expect(types).toContain('words_1k');
      expect(types).toContain('words_10k');
      expect(types).toContain('words_50k');
      expect(types).toContain('words_100k');
      expect(types).toContain('words_200k');
    });

    it('连续打卡百日成钢', () => {
      const projectId = seedProject();

      const awarded = achievementRepo.checkAndAward(projectId, { currentStreak: 100 });
      const types = awarded.map((a) => a.badge_type);

      expect(types).toContain('streak_7');
      expect(types).toContain('streak_30');
      expect(types).toContain('streak_100');
    });

    it('context全部为undefined时使用默认值0', () => {
      const projectId = seedProject();

      const awarded = achievementRepo.checkAndAward(projectId, {});

      expect(awarded).toEqual([]);
    });

    it('百章大成和打卡传奇', () => {
      const projectId = seedProject();

      const awarded = achievementRepo.checkAndAward(projectId, {
        chapterCount: 100,
        checkInCount: 100,
      });
      const types = awarded.map((a) => a.badge_type);

      expect(types).toContain('chapters_10');
      expect(types).toContain('chapters_50');
      expect(types).toContain('chapters_100');
      expect(types).toContain('checkin_first');
      expect(types).toContain('checkin_30');
      expect(types).toContain('checkin_100');
    });
  });
});
