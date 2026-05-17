import { getDb } from '../db/database.js';
import { logger } from '../middleware/logger.js';

interface NameEntry {
  id: string;
  name: string;
  nickname: string | null;
  roleType: string;
}

interface NameIssue {
  chapterId: string;
  chapterTitle: string;
  type: 'name_mismatch';
  severity: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  suggestion: string;
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
  }
  return dp[m][n];
}

export function scanProjectNames(projectId: string, chapterIds?: string[]): NameIssue[] {
  const db = getDb();

  // Get all character names
  const characters = db.prepare('SELECT id, name, nickname, role_type FROM characters WHERE project_id = ?').all(projectId) as NameEntry[];
  if (characters.length === 0) return [];

  const nameMap = new Map<string, { id: string; names: string[] }>();
  for (const c of characters) {
    const names = [c.name];
    if (c.nickname) names.push(c.nickname);
    nameMap.set(c.id, { id: c.id, names });
  }

  const allKnownNames = new Set<string>();
  for (const c of characters) {
    allKnownNames.add(c.name);
    if (c.nickname) allKnownNames.add(c.nickname);
  }

  // Get chapters to scan
  let chapters: { id: string; title: string; content: string }[];
  if (chapterIds && chapterIds.length > 0) {
    chapters = db.prepare('SELECT id, title, content FROM chapters WHERE project_id = ? AND id IN (' + chapterIds.map(() => '?').join(',') + ')').all(projectId, ...chapterIds) as typeof chapters;
  } else {
    chapters = db.prepare('SELECT id, title, content FROM chapters WHERE project_id = ? ORDER BY sort_order ASC').all(projectId) as typeof chapters;
  }

  const issues: NameIssue[] = [];
  const seenDescriptions = new Set<string>();

  for (const chapter of chapters) {
    if (!chapter.content) continue;
    const text = chapter.content;

    // Extract all CJK names (2-4 char sequences that could be names)
    const cjkNamePattern = /[一-鿿]{2,4}/g;
    const matches = text.matchAll(cjkNamePattern);

    const nameOccurrences = new Map<string, number>();
    for (const m of matches) {
      const word = m[0];
      nameOccurrences.set(word, (nameOccurrences.get(word) ?? 0) + 1);
    }

    // Check for potential misspellings of known character names
    for (const [word, count] of nameOccurrences) {
      if (allKnownNames.has(word)) continue;
      if (count < 2) continue; // Only flag if appears multiple times

      for (const c of characters) {
        const allNames = [c.name];
        if (c.nickname) allNames.push(c.nickname);

        for (const knownName of allNames) {
          const dist = levenshtein(word, knownName);
          if (dist > 0 && dist <= 2 && dist < knownName.length / 2) {
            const desc = `章节「${chapter.title}」中「${word}」出现了 ${count} 次，与角色「${knownName}」的编辑距离为 ${dist}，可能是笔误。`;
            if (!seenDescriptions.has(desc)) {
              seenDescriptions.add(desc);
              issues.push({
                chapterId: chapter.id,
                chapterTitle: chapter.title,
                type: 'name_mismatch',
                severity: 'low',
                title: `疑似角色名笔误: "${word}" → "${knownName}"?`,
                description: desc,
                suggestion: `检查是否应为「${knownName}」。如果是有意使用的新称呼，可以忽略。`,
              });
            }
          }
        }
      }
    }

    // Check for characters mentioned with variant forms across the chapter
    // (e.g., using full name in one place, nickname in another without establishing context)
    const mentionedChars = new Map<string, string[]>();
    for (const c of characters) {
      const allNames = [c.name];
      if (c.nickname) allNames.push(c.nickname);
      const usedNames: string[] = [];
      for (const name of allNames) {
        if (text.includes(name)) usedNames.push(name);
      }
      if (usedNames.length > 1) {
        mentionedChars.set(c.id, usedNames);
      }
    }

    for (const [_charId, usedNames] of mentionedChars) {
      // This is fine - using both name and nickname is normal
      // Only flag if using nickname without ever using full name
      // (skip this check as it's too noisy for Chinese web novels)
    }
  }

  logger.info({ projectId, issuesFound: issues.length }, 'Name scan completed');
  return issues;
}
