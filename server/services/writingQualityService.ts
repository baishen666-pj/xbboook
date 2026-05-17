import { getDb } from '../db/database.js';

export interface QualityIssue {
  type: 'grammar' | 'style' | 'readability' | 'repetition' | 'clarity';
  severity: 'info' | 'warning' | 'error';
  message: string;
  offset: number;
  length: number;
  suggestion: string;
}

export interface QualityReport {
  overallScore: number;
  readabilityScore: number;
  avgSentenceLength: number;
  avgWordLength: number;
  totalSentences: number;
  totalParagraphs: number;
  vocabularyRichness: number;
  issues: QualityIssue[];
  summary: string;
}

interface Sentence {
  text: string;
  offset: number;
  wordCount: number;
  charCount: number;
}

function splitSentences(text: string): Sentence[] {
  const sentences: Sentence[] = [];
  const regex = /[^。！？；…\n]+[。！？；…]*/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const s = match[0].trim();
    if (!s) continue;
    sentences.push({
      text: s,
      offset: match.index,
      wordCount: countWords(s),
      charCount: s.length,
    });
  }

  if (sentences.length === 0 && text.trim().length > 0) {
    sentences.push({
      text: text.trim(),
      offset: 0,
      wordCount: countWords(text),
      charCount: text.length,
    });
  }

  return sentences;
}

function countWords(text: string): number {
  const chinese = text.match(/[一-鿿]/g);
  const english = text.match(/[a-zA-Z]+/g);
  return (chinese?.length ?? 0) + (english?.length ?? 0);
}

function countParagraphs(text: string): number {
  return text.split(/\n\s*\n/).filter((p) => p.trim().length > 0).length || 1;
}

function calculateReadability(sentences: Sentence[]): number {
  if (sentences.length === 0) return 100;

  const avgLen = sentences.reduce((sum, s) => sum + s.wordCount, 0) / sentences.length;

  // Ideal Chinese sentence: 15-30 characters. Score drops for too long/short.
  if (avgLen <= 5) return 60;
  if (avgLen <= 15) return 90;
  if (avgLen <= 30) return 100;
  if (avgLen <= 50) return 75;
  if (avgLen <= 80) return 55;
  return 40;
}

function calculateVocabularyRichness(text: string): number {
  const chars = text.match(/[一-鿿]/g);
  if (!chars || chars.length === 0) return 0;

  const unique = new Set(chars);
  return Math.round((unique.size / chars.length) * 100);
}

function checkSentenceLength(sentences: Sentence[]): QualityIssue[] {
  const issues: QualityIssue[] = [];

  for (const s of sentences) {
    if (s.wordCount > 80) {
      issues.push({
        type: 'readability',
        severity: 'error',
        message: '句子过长，建议拆分',
        offset: s.offset,
        length: s.charCount,
        suggestion: '将长句拆分为2-3个短句，提高可读性',
      });
    } else if (s.wordCount > 50) {
      issues.push({
        type: 'readability',
        severity: 'warning',
        message: '句子偏长，可考虑拆分',
        offset: s.offset,
        length: s.charCount,
        suggestion: '适当使用句号断句',
      });
    } else if (s.wordCount < 3 && s.wordCount > 0) {
      issues.push({
        type: 'style',
        severity: 'info',
        message: '句子过短',
        offset: s.offset,
        length: s.charCount,
        suggestion: '考虑合并相邻短句或补充细节',
      });
    }
  }

  return issues;
}

function checkRepetition(text: string): QualityIssue[] {
  const issues: QualityIssue[] = [];

  // Check for repeated phrases (4+ chars)
  const phrasePattern = /[一-鿿]{4,}/g;
  const phraseSet = new Set<string>();
  let pm: RegExpExecArray | null;
  while ((pm = phrasePattern.exec(text)) !== null) {
    phraseSet.add(pm[0]);
  }

  for (const phrase of phraseSet) {
    const positions: number[] = [];
    let searchFrom = 0;
    let idx: number;
    while ((idx = text.indexOf(phrase, searchFrom)) !== -1) {
      positions.push(idx);
      searchFrom = idx + 1;
    }

    if (positions.length >= 3) {
      issues.push({
        type: 'repetition',
        severity: 'warning',
        message: `短语"${phrase}"重复出现${positions.length}次`,
        offset: positions[0],
        length: phrase.length,
        suggestion: '使用同义词或变换表达方式',
      });
    }
  }

  // Check for repeated word patterns
  const charCounts = new Map<string, number>();
  const chineseChars = text.match(/[一-鿿]/g) ?? [];
  for (const c of chineseChars) {
    charCounts.set(c, (charCounts.get(c) ?? 0) + 1);
  }

  const totalChars = chineseChars.length;
  if (totalChars > 100) {
    for (const [char, count] of charCounts) {
      const freq = count / totalChars;
      if (freq > 0.05 && char.length === 1) {
        issues.push({
          type: 'repetition',
          severity: 'info',
          message: `字"${char}"出现频率较高(${(freq * 100).toFixed(1)}%)`,
          offset: text.indexOf(char),
          length: 1,
          suggestion: '注意用词多样性',
        });
      }
    }
  }

  return issues.slice(0, 10); // Cap at 10 repetition warnings
}

function checkStyle(text: string): QualityIssue[] {
  const issues: QualityIssue[] = [];

  // Check for excessive exclamation marks
  const exclamations = (text.match(/[！!]{2,}/g) ?? []).length;
  if (exclamations > 3) {
    const idx = text.search(/[！!]{2,}/);
    if (idx >= 0) {
      issues.push({
        type: 'style',
        severity: 'info',
        message: '感叹号使用过多',
        offset: idx,
        length: 2,
        suggestion: '减少感叹号使用，用描写传达情绪',
      });
    }
  }

  // Check for ellipsis abuse
  const ellipsis = (text.match(/……/g) ?? []).length;
  if (ellipsis > 10) {
    const idx = text.indexOf('……');
    issues.push({
      type: 'style',
      severity: 'info',
      message: `省略号使用${ellipsis}次，偏多`,
      offset: idx,
      length: 2,
      suggestion: '适度使用省略号',
    });
  }

  // Check paragraph length
  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
  for (const p of paragraphs) {
    const pWordCount = countWords(p);
    if (pWordCount > 300) {
      const idx = text.indexOf(p.trim());
      if (idx >= 0) {
        issues.push({
          type: 'readability',
          severity: 'warning',
          message: `段落过长(${pWordCount}字)，建议分段`,
          offset: idx,
          length: Math.min(p.trim().length, 50),
          suggestion: '将长段落拆分为2-3段',
        });
      }
    }
  }

  return issues;
}

function checkGrammar(text: string): QualityIssue[] {
  const issues: QualityIssue[] = [];

  // Common Chinese grammar issues
  const patterns: Array<{ regex: RegExp; message: string; suggestion: string; severity: QualityIssue['severity'] }> = [
    { regex: /的的/g, message: '连续使用"的"', suggestion: '检查是否需要简化', severity: 'warning' },
    { regex: /了了/g, message: '连续使用"了"', suggestion: '检查是否需要简化', severity: 'warning' },
    { regex: /地地/g, message: '连续使用"地"', suggestion: '检查是否需要简化', severity: 'warning' },
    { regex: /得得/g, message: '连续使用"得"', suggestion: '检查是否需要简化', severity: 'warning' },
    { regex: /我我/g, message: '连续使用"我"', suggestion: '检查是否输入错误', severity: 'error' },
    { regex: /他他/g, message: '连续使用"他"', suggestion: '检查是否输入错误', severity: 'error' },
    { regex: /是.*是.*是/g, message: '短句内多次使用"是"', suggestion: '减少"是"的使用', severity: 'info' },
  ];

  for (const p of patterns) {
    let match: RegExpExecArray | null;
    while ((match = p.regex.exec(text)) !== null) {
      issues.push({
        type: 'grammar',
        severity: p.severity,
        message: p.message,
        offset: match.index,
        length: match[0].length,
        suggestion: p.suggestion,
      });
    }
  }

  return issues;
}

export function analyzeText(text: string): QualityReport {
  if (!text || text.trim().length === 0) {
    return {
      overallScore: 100,
      readabilityScore: 100,
      avgSentenceLength: 0,
      avgWordLength: 0,
      totalSentences: 0,
      totalParagraphs: 0,
      vocabularyRichness: 0,
      issues: [],
      summary: '空文本',
    };
  }

  const sentences = splitSentences(text);
  const totalSentences = sentences.length;
  const totalParagraphs = countParagraphs(text);
  const totalWords = countWords(text);
  const totalChars = text.replace(/\s/g, '').length;

  const avgSentenceLength = totalSentences > 0
    ? Math.round(sentences.reduce((sum, s) => sum + s.wordCount, 0) / totalSentences)
    : 0;

  const avgWordLength = totalWords > 0
    ? Math.round(totalChars / totalWords)
    : 0;

  const readabilityScore = calculateReadability(sentences);
  const vocabularyRichness = calculateVocabularyRichness(text);

  // Collect all issues
  const issues: QualityIssue[] = [
    ...checkSentenceLength(sentences),
    ...checkRepetition(text),
    ...checkStyle(text),
    ...checkGrammar(text),
  ];

  // Deduplicate and sort by severity
  const severityOrder: Record<string, number> = { error: 0, warning: 1, info: 2 };
  issues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  // Cap at 50 issues
  const cappedIssues = issues.slice(0, 50);

  // Calculate overall score (0-100)
  const errorPenalty = cappedIssues.filter((i) => i.severity === 'error').length * 5;
  const warningPenalty = cappedIssues.filter((i) => i.severity === 'warning').length * 2;
  const infoPenalty = cappedIssues.filter((i) => i.severity === 'info').length * 0.5;
  const overallScore = Math.max(0, Math.min(100, Math.round(
    readabilityScore * 0.4 +
    Math.min(vocabularyRichness, 80) * 0.3 +
    80 * 0.3 -
    errorPenalty -
    warningPenalty -
    infoPenalty
  )));

  // Generate summary
  const errorCount = cappedIssues.filter((i) => i.severity === 'error').length;
  const warningCount = cappedIssues.filter((i) => i.severity === 'warning').length;

  let summary = '';
  if (overallScore >= 90) {
    summary = '文本质量优秀';
  } else if (overallScore >= 75) {
    summary = '文本质量良好';
  } else if (overallScore >= 60) {
    summary = '文本质量一般，有改进空间';
  } else {
    summary = '文本质量需要改进';
  }

  if (errorCount > 0) summary += `，${errorCount}个错误`;
  if (warningCount > 0) summary += `，${warningCount}个警告`;

  return {
    overallScore,
    readabilityScore,
    avgSentenceLength,
    avgWordLength,
    totalSentences,
    totalParagraphs,
    vocabularyRichness,
    issues: cappedIssues,
    summary,
  };
}

export function analyzeChapter(chapterId: string): QualityReport | null {
  const db = getDb();
  const chapter = db
    .prepare('SELECT * FROM chapters WHERE id = ?')
    .get(chapterId) as { file_path: string; project_id: string } | undefined;

  if (!chapter) return null;

  // For this service we analyze the stored content
  // In production, this would read from fileService
  return null;
}

export function compareQuality(reportA: QualityReport, reportB: QualityReport): {
  scoreDiff: number;
  improvements: string[];
  regressions: string[];
} {
  const scoreDiff = reportB.overallScore - reportA.overallScore;
  const improvements: string[] = [];
  const regressions: string[] = [];

  if (reportB.readabilityScore > reportA.readabilityScore) {
    improvements.push(`可读性提高 (${reportA.readabilityScore} → ${reportB.readabilityScore})`);
  } else if (reportB.readabilityScore < reportA.readabilityScore) {
    regressions.push(`可读性下降 (${reportA.readabilityScore} → ${reportB.readabilityScore})`);
  }

  if (reportB.vocabularyRichness > reportA.vocabularyRichness + 5) {
    improvements.push('词汇丰富度提高');
  } else if (reportB.vocabularyRichness < reportA.vocabularyRichness - 5) {
    regressions.push('词汇丰富度下降');
  }

  const errorDiff = reportB.issues.filter((i) => i.severity === 'error').length -
    reportA.issues.filter((i) => i.severity === 'error').length;
  if (errorDiff < 0) improvements.push(`减少了${Math.abs(errorDiff)}个错误`);
  if (errorDiff > 0) regressions.push(`增加了${errorDiff}个错误`);

  return { scoreDiff, improvements, regressions };
}
