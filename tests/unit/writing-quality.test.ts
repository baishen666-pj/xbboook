import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';

let testDb: Database.Database;

function createTestDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE projects (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT, genre TEXT,
      writing_style TEXT, writing_mode TEXT DEFAULT 'webnovel', target_words INTEGER,
      status TEXT DEFAULT 'active', sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE volumes (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, title TEXT NOT NULL, summary TEXT,
      sort_order INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
    CREATE TABLE chapters (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, volume_id TEXT, title TEXT NOT NULL,
      summary TEXT, word_count INTEGER DEFAULT 0, file_path TEXT NOT NULL,
      status TEXT DEFAULT 'draft', sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (volume_id) REFERENCES volumes(id) ON DELETE SET NULL
    );
    CREATE TABLE chat_messages (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, chapter_id TEXT,
      role TEXT NOT NULL CHECK(role IN ('user','assistant','system')),
      content TEXT NOT NULL, skill_id TEXT DEFAULT '', token_usage INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
    );
  `);
  return db;
}

describe('writingQualityService', () => {
  let analyzeText: typeof import('../../server/services/writingQualityService.js').analyzeText;
  let compareQuality: typeof import('../../server/services/writingQualityService.js').compareQuality;

  beforeEach(async () => {
    testDb = createTestDb();
    vi.doMock('../../server/db/database.js', () => ({
      getDb: () => testDb,
      closeDb: () => {},
    }));
    const mod = await import('../../server/services/writingQualityService.js');
    analyzeText = mod.analyzeText;
    compareQuality = mod.compareQuality;
  });

  afterEach(() => {
    vi.doUnmock('../../server/db/database.js');
    vi.restoreAllMocks();
    if (testDb) testDb.close();
  });

  describe('analyzeText', () => {
    it('returns empty report for empty text', () => {
      const report = analyzeText('');

      expect(report.overallScore).toBe(100);
      expect(report.issues).toHaveLength(0);
      expect(report.totalSentences).toBe(0);
    });

    it('returns empty report for whitespace-only text', () => {
      const report = analyzeText('   \n\n   ');
      expect(report.overallScore).toBe(100);
    });

    it('analyzes simple good text', () => {
      const text = '这是一个普通的句子。这段文字没有问题。故事从一个小镇开始。主角在清晨醒来。';
      const report = analyzeText(text);

      expect(report.totalSentences).toBeGreaterThan(0);
      expect(report.overallScore).toBeGreaterThan(0);
      expect(report.avgSentenceLength).toBeGreaterThan(0);
    });

    it('detects long sentences', () => {
      const longSentence = '这'.repeat(100) + '。';
      const report = analyzeText(longSentence);

      const longIssues = report.issues.filter((i) => i.type === 'readability' && i.severity === 'error');
      expect(longIssues.length).toBeGreaterThan(0);
    });

    it('detects repeated phrases', () => {
      const phrase = '月光下的古城';
      const text = `${phrase}，${phrase}，${phrase}。`;
      const report = analyzeText(text);

      const repIssues = report.issues.filter((i) => i.type === 'repetition');
      expect(repIssues.length).toBeGreaterThan(0);
    });

    it('detects consecutive 的的', () => {
      const text = '美丽的的花朵。';
      const report = analyzeText(text);

      const grammarIssues = report.issues.filter((i) => i.type === 'grammar' && i.message.includes('的'));
      expect(grammarIssues.length).toBeGreaterThan(0);
    });

    it('detects consecutive 了了', () => {
      const text = '他吃了了饭。';
      const report = analyzeText(text);

      const grammarIssues = report.issues.filter((i) => i.type === 'grammar' && i.message.includes('了'));
      expect(grammarIssues.length).toBeGreaterThan(0);
    });

    it('calculates vocabulary richness', () => {
      // Text with many unique chars
      const richText = '春风吹拂大地万物复苏江河湖海山川壮丽';
      const report = analyzeText(richText);
      expect(report.vocabularyRichness).toBeGreaterThan(0);
    });

    it('reports paragraph count', () => {
      const text = '第一段内容。\n\n第二段内容。\n\n第三段内容。';
      const report = analyzeText(text);
      expect(report.totalParagraphs).toBe(3);
    });

    it('caps issues at 50', () => {
      // Generate text with many issues
      const parts: string[] = [];
      for (let i = 0; i < 100; i++) {
        parts.push('我的我的他的他的的了了');
      }
      const text = parts.join('。');
      const report = analyzeText(text);
      expect(report.issues.length).toBeLessThanOrEqual(50);
    });

    it('sorts issues by severity', () => {
      const text = '我的我的。' + '这'.repeat(100) + '。';
      const report = analyzeText(text);

      const severities = report.issues.map((i) => i.severity);
      const errorIdx = severities.indexOf('error');
      const warnIdx = severities.indexOf('warning');
      if (errorIdx >= 0 && warnIdx >= 0) {
        expect(errorIdx).toBeLessThan(warnIdx);
      }
    });
  });

  describe('compareQuality', () => {
    it('detects improvements', () => {
      const reportA = analyzeText('我的我的。的了了了。');
      const reportB = analyzeText('这是一段正常的文字。没有语法错误。');

      const result = compareQuality(reportA, reportB);
      expect(result.scoreDiff).toBeGreaterThan(0);
    });

    it('detects regressions', () => {
      const reportA = analyzeText('这是一段正常的文字。没有语法错误。');
      const reportB = analyzeText('我的我的。的了了了。');

      const result = compareQuality(reportA, reportB);
      expect(result.scoreDiff).toBeLessThan(0);
    });

    it('reports improvements list', () => {
      const reportA = analyzeText('我我他的他。');
      const reportB = analyzeText('清晨的阳光洒满大地，万物披上金色的外衣。');

      const result = compareQuality(reportA, reportB);
      expect(result.improvements.length).toBeGreaterThan(0);
    });
  });
});
