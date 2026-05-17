import { v4 as uuid } from 'uuid';
import { getDb } from '../database.js';

export interface StyleFingerprintRow {
  id: string;
  project_id: string;
  sentence_patterns: string; // JSON
  vocabulary_profile: string; // JSON
  rhythm_profile: string; // JSON
  dialogue_signatures: string; // JSON
  narrative_habits: string; // JSON
  sample_chapter_ids: string; // JSON
  sample_size: number;
  summary: string;
  created_at: string;
  updated_at: string;
}

export function create(
  projectId: string,
  data: {
    sentencePatterns: unknown;
    vocabularyProfile: unknown;
    rhythmProfile: unknown;
    dialogueSignatures: unknown;
    narrativeHabits: unknown;
    sampleChapterIds: string[];
    sampleSize: number;
    summary: string;
  },
): StyleFingerprintRow {
  const db = getDb();
  const id = uuid();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO style_fingerprints (id, project_id, sentence_patterns, vocabulary_profile, rhythm_profile, dialogue_signatures, narrative_habits, sample_chapter_ids, sample_size, summary, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id, projectId,
    JSON.stringify(data.sentencePatterns),
    JSON.stringify(data.vocabularyProfile),
    JSON.stringify(data.rhythmProfile),
    JSON.stringify(data.dialogueSignatures),
    JSON.stringify(data.narrativeHabits),
    JSON.stringify(data.sampleChapterIds),
    data.sampleSize, data.summary,
    now, now,
  );
  return findById(id)!;
}

export function findById(id: string): StyleFingerprintRow | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM style_fingerprints WHERE id = ?').get(id) as StyleFingerprintRow | undefined;
}

export function findByProject(projectId: string): StyleFingerprintRow | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM style_fingerprints WHERE project_id = ?').get(projectId) as StyleFingerprintRow | undefined;
}

export function update(
  id: string,
  data: {
    sentencePatterns?: unknown;
    vocabularyProfile?: unknown;
    rhythmProfile?: unknown;
    dialogueSignatures?: unknown;
    narrativeHabits?: unknown;
    sampleChapterIds?: string[];
    sampleSize?: number;
    summary?: string;
  },
): void {
  const db = getDb();
  const now = new Date().toISOString();
  const sets: string[] = ['updated_at = ?'];
  const values: unknown[] = [now];

  if (data.sentencePatterns !== undefined) { sets.push('sentence_patterns = ?'); values.push(JSON.stringify(data.sentencePatterns)); }
  if (data.vocabularyProfile !== undefined) { sets.push('vocabulary_profile = ?'); values.push(JSON.stringify(data.vocabularyProfile)); }
  if (data.rhythmProfile !== undefined) { sets.push('rhythm_profile = ?'); values.push(JSON.stringify(data.rhythmProfile)); }
  if (data.dialogueSignatures !== undefined) { sets.push('dialogue_signatures = ?'); values.push(JSON.stringify(data.dialogueSignatures)); }
  if (data.narrativeHabits !== undefined) { sets.push('narrative_habits = ?'); values.push(JSON.stringify(data.narrativeHabits)); }
  if (data.sampleChapterIds !== undefined) { sets.push('sample_chapter_ids = ?'); values.push(JSON.stringify(data.sampleChapterIds)); }
  if (data.sampleSize !== undefined) { sets.push('sample_size = ?'); values.push(data.sampleSize); }
  if (data.summary !== undefined) { sets.push('summary = ?'); values.push(data.summary); }

  values.push(id);
  db.prepare(`UPDATE style_fingerprints SET ${sets.join(', ')} WHERE id = ?`).run(...values);
}

export function deleteByProject(projectId: string): void {
  const db = getDb();
  db.prepare('DELETE FROM style_fingerprints WHERE project_id = ?').run(projectId);
}
