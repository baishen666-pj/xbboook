import fs from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';
import { getDb } from '../db/database.js';
import * as statsRepo from '../db/repositories/statsRepo.js';
import * as sessionRepo from '../db/repositories/sessionRepo.js';

const DATA_ROOT = path.resolve(process.cwd(), 'data', 'projects');

export interface DashboardData {
  summary: {
    totalWords: number;
    totalDays: number;
    avgDaily: number;
    bestDay: { date: string; words: number } | null;
  };
  velocity: { date: string; words: number; sessions: number }[];
  chapterStatus: { status: string; count: number }[];
  streak: { current: number; longest: number };
  target: { target: number; current: number; percentage: number };
  peakHours: { hour: number; count: number }[];
}

export function getDashboardData(projectId: string, days = 30): DashboardData {
  return {
    summary: statsRepo.getSummary(projectId),
    velocity: sessionRepo.getDailyWritingStats(projectId, days),
    chapterStatus: statsRepo.getChapterStatusDistribution(projectId),
    streak: statsRepo.getWritingStreak(projectId),
    target: statsRepo.getTargetProgress(projectId),
    peakHours: sessionRepo.getHourlyDistribution(projectId, days),
  };
}

export async function getCharacterAppearances(projectId: string): Promise<{ name: string; count: number }[]> {
  const db = getDb();
  const characters = db.prepare(
    'SELECT name FROM characters WHERE project_id = ? ORDER BY sort_order'
  ).all(projectId) as { name: string }[];

  if (characters.length === 0) return [];

  const chaptersDir = path.resolve(DATA_ROOT, projectId, 'chapters');
  if (!existsSync(chaptersDir)) return [];

  const counts = new Map<string, number>();
  for (const ch of characters) {
    counts.set(ch.name, 0);
  }

  const files = await fs.readdir(chaptersDir);
  for (const file of files) {
    if (!file.endsWith('.md')) continue;
    const content = await fs.readFile(path.join(chaptersDir, file), 'utf-8');
    for (const [name] of counts) {
      const regex = new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      const matches = content.match(regex);
      if (matches) counts.set(name, counts.get(name)! + matches.length);
    }
  }

  return Array.from(counts.entries())
    .filter(([, c]) => c > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }));
}
