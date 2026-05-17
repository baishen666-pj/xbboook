import { completeChat } from './agentFactory.js';
import * as chapterRepo from '../db/repositories/chapterRepo.js';
import { readChapter } from '../services/fileService.js';
import * as styleFingerprintRepo from '../db/repositories/styleFingerprintRepo.js';
import { analyzeContent } from '../services/contentAnalysis.js';
import { logger } from '../middleware/logger.js';
import type { ContextSource } from './contextBuilder.js';

export interface SentencePattern {
  type: string;
  frequency: number;
  examples: string[];
}

export interface VocabularyProfile {
  avgWordLength: number;
  uniqueRatio: number;
  topPhrases: string[];
  punctuationProfile: Record<string, number>;
}

export interface RhythmProfile {
  avgSentenceLength: number;
  avgParagraphLength: number;
  sentenceVariance: number;
  paragraphVariance: number;
  dialogueProportion: number;
  descriptionProportion: number;
  actionProportion: number;
}

export interface DialogueSignature {
  characterId: string;
  characterName: string;
  avgLength: number;
  commonPatterns: string[];
}

export interface NarrativeHabits {
  povType: string;
  tensePreference: string;
  sceneTransitionStyle: string;
  descriptionDensity: number;
  emotionalExpression: string;
}

export interface StyleFingerprint {
  sentencePatterns: SentencePattern[];
  vocabularyProfile: VocabularyProfile;
  rhythmProfile: RhythmProfile;
  dialogueSignatures: DialogueSignature[];
  narrativeHabits: NarrativeHabits;
  sampleChapterIds: string[];
  sampleSize: number;
  summary: string;
}

const NARRATIVE_ANALYSIS_PROMPT = `你是一位文学分析专家。请分析以下文本的叙事风格特征。

请严格按照以下 JSON 格式输出（不要加 markdown 代码块标记）：
{
  "povType": "first|third_limited|third_omniscient|mixed",
  "tensePreference": "past|present|mixed",
  "sceneTransitionStyle": "hard_cut|gradual|temporal_skip",
  "descriptionDensity": 0.6,
  "emotionalExpression": "explicit|implicit|mixed",
  "literaryDevices": ["比喻", "排比"],
  "toneKeywords": ["冷峻", "克制"],
  "summary": "一句话风格总结"
}`;

export async function extractFingerprint(
  projectId: string,
  chapterIds?: string[],
): Promise<StyleFingerprint> {
  // Collect sample chapters
  const chapters = chapterIds?.length
    ? chapterIds.map(id => chapterRepo.findById(id)).filter(Boolean)
    : chapterRepo.findByProject(projectId)
        .filter((c: { status?: string }) => c.status === 'completed' || c.status === 'writing')
        .slice(-5);

  const sampleIds: string[] = [];
  const contents: string[] = [];

  for (const ch of chapters) {
    if (!ch) continue;
    try {
      const content = await readChapter(projectId, ch.id);
      if (content.trim()) {
        sampleIds.push(ch.id);
        contents.push(content);
      }
    } catch { /* skip */ }
  }

  if (contents.length === 0) {
    throw new Error('没有可分析的章节内容');
  }

  const fullText = contents.join('\n\n');

  // Local analysis: sentence patterns
  const sentencePatterns = extractSentencePatterns(fullText);

  // Local analysis: vocabulary profile
  const vocabularyProfile = extractVocabularyProfile(fullText);

  // Local analysis: rhythm profile (reuse contentAnalysis)
  const analysis = analyzeContent(fullText);
  const rhythmProfile: RhythmProfile = {
    avgSentenceLength: calculateAvgSentenceLength(fullText),
    avgParagraphLength: analysis.avgParagraphLength,
    sentenceVariance: calculateSentenceVariance(fullText),
    paragraphVariance: calculateParagraphVariance(fullText),
    dialogueProportion: analysis.dialogueRatio,
    descriptionProportion: Math.max(0, 1 - analysis.dialogueRatio) * 0.6,
    actionProportion: Math.max(0, 1 - analysis.dialogueRatio) * 0.4,
  };

  // AI analysis: narrative habits
  const narrativeHabits = await extractNarrativeHabits(fullText);

  // Local analysis: dialogue signatures
  const dialogueSignatures = extractDialogueSignatures(fullText);

  const summary = `基于${sampleIds.length}个章节的风格分析：${narrativeHabits.summary || '风格指纹已生成'}`;

  const fingerprint: StyleFingerprint = {
    sentencePatterns,
    vocabularyProfile,
    rhythmProfile,
    dialogueSignatures,
    narrativeHabits,
    sampleChapterIds: sampleIds,
    sampleSize: sampleIds.length,
    summary,
  };

  // Upsert to DB
  const existing = styleFingerprintRepo.findByProject(projectId);
  if (existing) {
    styleFingerprintRepo.update(existing.id, {
      sentencePatterns: fingerprint.sentencePatterns,
      vocabularyProfile: fingerprint.vocabularyProfile,
      rhythmProfile: fingerprint.rhythmProfile,
      dialogueSignatures: fingerprint.dialogueSignatures,
      narrativeHabits: fingerprint.narrativeHabits,
      sampleChapterIds: fingerprint.sampleChapterIds,
      sampleSize: fingerprint.sampleSize,
      summary: fingerprint.summary,
    });
    fingerprint.id = existing.id;
  } else {
    const row = styleFingerprintRepo.create(projectId, {
      sentencePatterns: fingerprint.sentencePatterns,
      vocabularyProfile: fingerprint.vocabularyProfile,
      rhythmProfile: fingerprint.rhythmProfile,
      dialogueSignatures: fingerprint.dialogueSignatures,
      narrativeHabits: fingerprint.narrativeHabits,
      sampleChapterIds: fingerprint.sampleChapterIds,
      sampleSize: fingerprint.sampleSize,
      summary: fingerprint.summary,
    });
    fingerprint.id = row.id;
  }

  return fingerprint;
}

export function getFingerprint(projectId: string): StyleFingerprint | null {
  const row = styleFingerprintRepo.findByProject(projectId);
  if (!row) return null;
  return {
    id: row.id,
    sentencePatterns: JSON.parse(row.sentence_patterns),
    vocabularyProfile: JSON.parse(row.vocabulary_profile),
    rhythmProfile: JSON.parse(row.rhythm_profile),
    dialogueSignatures: JSON.parse(row.dialogue_signatures),
    narrativeHabits: JSON.parse(row.narrative_habits),
    sampleChapterIds: JSON.parse(row.sample_chapter_ids),
    sampleSize: row.sample_size,
    summary: row.summary,
  };
}

export function buildStyleInjectionPrompt(fp: StyleFingerprint): string {
  const lines: string[] = ['请严格遵循以下写作风格：'];

  if (fp.narrativeHabits.povType) lines.push(`- 视角：${fp.narrativeHabits.povType}`);
  if (fp.narrativeHabits.tensePreference) lines.push(`- 时态：${fp.narrativeHabits.tensePreference}`);
  if (fp.narrativeHabits.emotionalExpression) lines.push(`- 情感表达：${fp.narrativeHabits.emotionalExpression}`);
  if (fp.narrativeHabits.sceneTransitionStyle) lines.push(`- 场景过渡：${fp.narrativeHabits.sceneTransitionStyle}`);

  lines.push(`- 平均句长约${fp.rhythmProfile.avgSentenceLength}字，段落约${fp.rhythmProfile.avgParagraphLength}字`);
  lines.push(`- 对话占比约${Math.round(fp.rhythmProfile.dialogueProportion * 100)}%`);

  if (fp.sentencePatterns.length > 0) {
    const top = fp.sentencePatterns.slice(0, 3);
    lines.push(`- 常用句式：${top.map(p => p.type).join('、')}`);
  }

  if (fp.vocabularyProfile.topPhrases.length > 0) {
    lines.push(`- 高频用语：${fp.vocabularyProfile.topPhrases.slice(0, 10).join('、')}`);
  }

  return lines.join('\n');
}

export function buildStyleInjectionSource(fp: StyleFingerprint): ContextSource {
  return {
    priority: 9,
    label: '风格指纹',
    content: buildStyleInjectionPrompt(fp),
  };
}

// --- Local analysis helpers ---

function extractSentencePatterns(text: string): SentencePattern[] {
  const patterns: SentencePattern[] = [];
  const perThousand = text.length / 1000 || 1;

  // Parallel structure (排比): consecutive similar sentence structures
  const parallelRe = /(?:[^。！？；]{4,15}[，,]){2,}[^。！？；]{4,15}[。！？；]/g;
  const parallelMatches = text.match(parallelRe) || [];
  if (parallelMatches.length > 0) {
    patterns.push({
      type: '排比',
      frequency: Math.round(parallelMatches.length / perThousand * 10) / 10,
      examples: parallelMatches.slice(0, 3).map(m => m.slice(0, 50)),
    });
  }

  // Rhetorical questions (反问)
  const rhetoricalRe = /难道[^？?]*[？?]|岂[^？?]*[？?]|怎能[^？?]*[？?]/g;
  const rhetoricalMatches = text.match(rhetoricalRe) || [];
  if (rhetoricalMatches.length > 0) {
    patterns.push({
      type: '反问',
      frequency: Math.round(rhetoricalMatches.length / perThousand * 10) / 10,
      examples: rhetoricalMatches.slice(0, 3),
    });
  }

  // Short bursts (短句连发): 3+ consecutive sentences under 8 chars
  const sentences = text.split(/[。！？；]/).filter(s => s.trim().length > 0);
  let shortBurstCount = 0;
  let consecutiveShort = 0;
  for (const s of sentences) {
    if (s.trim().length <= 8) {
      consecutiveShort++;
      if (consecutiveShort >= 3) shortBurstCount++;
    } else {
      consecutiveShort = 0;
    }
  }
  if (shortBurstCount > 0) {
    patterns.push({
      type: '短句连发',
      frequency: Math.round(shortBurstCount / perThousand * 10) / 10,
      examples: [],
    });
  }

  // Long flowing sentences (>60 chars)
  const longSentences = sentences.filter(s => s.trim().length > 60);
  if (longSentences.length > 0) {
    patterns.push({
      type: '长句铺陈',
      frequency: Math.round(longSentences.length / perThousand * 10) / 10,
      examples: longSentences.slice(0, 3).map(s => s.trim().slice(0, 50) + '...'),
    });
  }

  return patterns;
}

function extractVocabularyProfile(text: string): VocabularyProfile {
  const cjkChars = text.replace(/[^一-鿿]/g, '');
  const avgWordLength = cjkChars.length > 0 ? text.length / cjkChars.length : 0;

  // Unique ratio
  const uniqueChars = new Set(cjkChars).size;
  const uniqueRatio = cjkChars.length > 0 ? uniqueChars / cjkChars.length : 0;

  // Top phrases (2-4 chars, using simple n-gram)
  const phraseCounts = new Map<string, number>();
  for (let len = 2; len <= 4; len++) {
    for (let i = 0; i <= cjkChars.length - len; i++) {
      const phrase = cjkChars.slice(i, i + len);
      phraseCounts.set(phrase, (phraseCounts.get(phrase) || 0) + 1);
    }
  }

  // Filter: only phrases appearing 3+ times, sort by frequency
  const topPhrases = [...phraseCounts.entries()]
    .filter(([, count]) => count >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([phrase]) => phrase);

  // Punctuation profile
  const punctuationProfile: Record<string, number> = {};
  const puncts = ['。', '，', '！', '？', '、', '；', '：', '"', '"', '…'];
  for (const p of puncts) {
    const count = (text.match(new RegExp(p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
    if (count > 0) punctuationProfile[p] = count;
  }

  return { avgWordLength, uniqueRatio, topPhrases, punctuationProfile };
}

function extractDialogueSignatures(_text: string): DialogueSignature[] {
  // Basic extraction: find dialogue lines and group
  // For now, return empty - full character-specific dialogue analysis requires character DB cross-reference
  return [];
}

async function extractNarrativeHabits(text: string): Promise<NarrativeHabits> {
  const sample = text.slice(0, 8000);

  try {
    const result = await completeChat(
      [
        { role: 'system', content: NARRATIVE_ANALYSIS_PROMPT },
        { role: 'user', content: `分析以下文本的叙事风格：\n\n${sample}` },
      ],
      { maxTokens: 500, temperature: 0.3 },
    );

    const cleaned = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned);

    return {
      povType: parsed.povType || 'third_limited',
      tensePreference: parsed.tensePreference || 'past',
      sceneTransitionStyle: parsed.sceneTransitionStyle || 'gradual',
      descriptionDensity: parsed.descriptionDensity || 0.5,
      emotionalExpression: parsed.emotionalExpression || 'mixed',
      summary: parsed.summary || '',
    };
  } catch (err) {
    logger.error({ err }, 'Narrative habits extraction failed');
    return {
      povType: 'third_limited',
      tensePreference: 'past',
      sceneTransitionStyle: 'gradual',
      descriptionDensity: 0.5,
      emotionalExpression: 'mixed',
      summary: '',
    };
  }
}

function calculateAvgSentenceLength(text: string): number {
  const plain = text.replace(/[^一-鿿。！？；]/g, '');
  const sentences = plain.split(/[。！？；]/).filter(s => s.length > 0);
  if (sentences.length === 0) return 0;
  return Math.round(sentences.reduce((sum, s) => sum + s.length, 0) / sentences.length);
}

function calculateSentenceVariance(text: string): number {
  const plain = text.replace(/[^一-鿿。！？；]/g, '');
  const sentences = plain.split(/[。！？；]/).filter(s => s.length > 0);
  if (sentences.length < 2) return 0;
  const avg = sentences.reduce((sum, s) => sum + s.length, 0) / sentences.length;
  const variance = sentences.reduce((sum, s) => sum + (s.length - avg) ** 2, 0) / sentences.length;
  return Math.round(Math.sqrt(variance) * 10) / 10;
}

function calculateParagraphVariance(text: string): number {
  const paragraphs = text.split(/\n+/).map(p => p.trim()).filter(p => p.length > 0);
  if (paragraphs.length < 2) return 0;
  const lengths = paragraphs.map(p => p.replace(/\s/g, '').length);
  const avg = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  const variance = lengths.reduce((sum, l) => sum + (l - avg) ** 2, 0) / lengths.length;
  return Math.round(Math.sqrt(variance));
}

declare module './styleLearner' {
  // Ensure StyleFingerprint can have an optional id field
}

// Augment StyleFingerprint with optional id
export interface StyleFingerprintWithId extends StyleFingerprint {
  id?: string;
}
