const API_BASE = '/api/projects';

export interface StyleFingerprint {
  id?: string;
  sentencePatterns: Array<{ type: string; frequency: number; examples: string[] }>;
  vocabularyProfile: {
    avgWordLength: number;
    uniqueRatio: number;
    topPhrases: string[];
    punctuationProfile: Record<string, number>;
  };
  rhythmProfile: {
    avgSentenceLength: number;
    avgParagraphLength: number;
    sentenceVariance: number;
    paragraphVariance: number;
    dialogueProportion: number;
    descriptionProportion: number;
    actionProportion: number;
  };
  dialogueSignatures: Array<{
    characterId: string;
    characterName: string;
    avgLength: number;
    commonPatterns: string[];
  }>;
  narrativeHabits: {
    povType: string;
    tensePreference: string;
    sceneTransitionStyle: string;
    descriptionDensity: number;
    emotionalExpression: string;
    summary?: string;
  };
  sampleChapterIds: string[];
  sampleSize: number;
  summary: string;
}

export async function extractStyleFingerprint(projectId: string, chapterIds?: string[]): Promise<StyleFingerprint> {
  const res = await fetch(`${API_BASE}/${projectId}/style-fingerprint`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chapterIds }),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error);
  return json.data;
}

export async function getStyleFingerprint(projectId: string): Promise<StyleFingerprint | null> {
  const res = await fetch(`${API_BASE}/${projectId}/style-fingerprint`);
  const json = await res.json();
  if (!json.success) return null;
  return json.data;
}

export async function deleteStyleFingerprint(projectId: string): Promise<void> {
  await fetch(`${API_BASE}/${projectId}/style-fingerprint`, { method: 'DELETE' });
}
