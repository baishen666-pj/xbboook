import { v4 as uuid } from 'uuid';
import { getDb } from '../database.js';

export interface Achievement {
  id: string;
  project_id: string;
  badge_type: string;
  earned_at: string;
  metadata: string | null;
}

export const BADGE_DEFINITIONS = [
  { type: 'first_chapter', name: '初出茅庐', description: '创建第一个章节', icon: '📖' },
  { type: 'words_1k', name: '千字达人', description: '累计写作1,000字', icon: '✏️' },
  { type: 'words_10k', name: '万字先锋', description: '累计写作10,000字', icon: '📝' },
  { type: 'words_50k', name: '笔耕不辍', description: '累计写作50,000字', icon: '✒️' },
  { type: 'words_100k', name: '著作等身', description: '累计写作100,000字', icon: '📚' },
  { type: 'words_200k', name: '鸿篇巨制', description: '累计写作200,000字', icon: '🏔️' },
  { type: 'streak_7', name: '坚持一周', description: '连续写作7天', icon: '🔥' },
  { type: 'streak_30', name: '月度作家', description: '连续写作30天', icon: '⭐' },
  { type: 'streak_100', name: '百日成钢', description: '连续写作100天', icon: '💎' },
  { type: 'chapters_10', name: '十章初成', description: '完成10个章节', icon: '📋' },
  { type: 'chapters_50', name: '半百之篇', description: '完成50个章节', icon: '📑' },
  { type: 'chapters_100', name: '百章大成', description: '完成100个章节', icon: '🏆' },
  { type: 'checkin_first', name: '首次打卡', description: '完成第一次打卡', icon: '✅' },
  { type: 'checkin_30', name: '打卡达人', description: '累计打卡30天', icon: '🎯' },
  { type: 'checkin_100', name: '打卡传奇', description: '累计打卡100天', icon: '👑' },
] as const;

export type BadgeType = typeof BADGE_DEFINITIONS[number]['type'];

export function findByProject(projectId: string): Achievement[] {
  const db = getDb();
  return db
    .prepare('SELECT * FROM achievements WHERE project_id = ? ORDER BY earned_at DESC')
    .all(projectId) as Achievement[];
}

export function hasBadge(projectId: string, badgeType: string): boolean {
  const db = getDb();
  const row = db
    .prepare('SELECT 1 FROM achievements WHERE project_id = ? AND badge_type = ?')
    .get(projectId, badgeType);
  return !!row;
}

export function earn(projectId: string, badgeType: BadgeType, metadata?: Record<string, unknown>): Achievement | null {
  if (hasBadge(projectId, badgeType)) return null;

  const db = getDb();
  const id = uuid();
  db.prepare(`
    INSERT INTO achievements (id, project_id, badge_type, metadata)
    VALUES (?, ?, ?, ?)
  `).run(id, projectId, badgeType, metadata ? JSON.stringify(metadata) : null);

  return db.prepare('SELECT * FROM achievements WHERE id = ?').get(id) as Achievement;
}

export function checkAndAward(
  projectId: string,
  context: {
    totalWords?: number;
    chapterCount?: number;
    checkInCount?: number;
    currentStreak?: number;
  },
): Achievement[] {
  const awarded: Achievement[] = [];

  const checks: Array<[BadgeType, boolean]> = [
    ['first_chapter', (context.chapterCount ?? 0) >= 1],
    ['words_1k', (context.totalWords ?? 0) >= 1000],
    ['words_10k', (context.totalWords ?? 0) >= 10000],
    ['words_50k', (context.totalWords ?? 0) >= 50000],
    ['words_100k', (context.totalWords ?? 0) >= 100000],
    ['words_200k', (context.totalWords ?? 0) >= 200000],
    ['streak_7', (context.currentStreak ?? 0) >= 7],
    ['streak_30', (context.currentStreak ?? 0) >= 30],
    ['streak_100', (context.currentStreak ?? 0) >= 100],
    ['chapters_10', (context.chapterCount ?? 0) >= 10],
    ['chapters_50', (context.chapterCount ?? 0) >= 50],
    ['chapters_100', (context.chapterCount ?? 0) >= 100],
    ['checkin_first', (context.checkInCount ?? 0) >= 1],
    ['checkin_30', (context.checkInCount ?? 0) >= 30],
    ['checkin_100', (context.checkInCount ?? 0) >= 100],
  ];

  for (const [badgeType, condition] of checks) {
    if (condition) {
      const result = earn(projectId, badgeType);
      if (result) awarded.push(result);
    }
  }

  return awarded;
}
