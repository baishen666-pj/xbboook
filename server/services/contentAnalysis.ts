export interface ContentAnalysis {
  readabilityScore: number;
  avgParagraphLength: number;
  longestParagraph: number;
  shortestParagraph: number;
  dialogueRatio: number;
  vocabularyDiversity: number;
  rhythmScore: number;
  paragraphLengths: number[];
}

export function analyzeContent(html: string): ContentAnalysis {
  const plain = html
    .replace(/<[^>]+>/g, "")
    .replace(/&[^;]+;/g, " ")
    .trim();

  if (!plain) {
    return {
      readabilityScore: 0,
      avgParagraphLength: 0,
      longestParagraph: 0,
      shortestParagraph: 0,
      dialogueRatio: 0,
      vocabularyDiversity: 0,
      rhythmScore: 0,
      paragraphLengths: [],
    };
  }

  const paragraphs = plain
    .split(/\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  const paragraphLengths = paragraphs.map((p) => p.length);
  const totalChars = plain.replace(/\s/g, "").length;

  // Avg paragraph length
  const avgParagraphLength =
    paragraphLengths.length > 0
      ? paragraphLengths.reduce((a, b) => a + b, 0) / paragraphLengths.length
      : 0;

  const longestParagraph =
    paragraphLengths.length > 0 ? Math.max(...paragraphLengths) : 0;
  const shortestParagraph =
    paragraphLengths.length > 0 ? Math.min(...paragraphLengths) : 0;

  // Readability score (1-10): based on avg sentence length and avg paragraph length
  // For Chinese text, "sentences" are separated by 。！？；
  const sentences = plain.split(/[。！？；]/).filter((s) => s.trim().length > 0);
  const avgSentenceLength =
    sentences.length > 0 ? totalChars / sentences.length : totalChars;

  // Ideal: avg sentence 15-40 chars, avg paragraph 50-200 chars
  const sentenceScore = Math.max(
    0,
    10 - Math.abs(avgSentenceLength - 25) / 5
  );
  const paragraphScore = Math.max(
    0,
    10 - Math.abs(avgParagraphLength - 120) / 30
  );
  const readabilityScore = Math.round(
    Math.min(10, Math.max(1, sentenceScore * 0.6 + paragraphScore * 0.4))
  );

  // Dialogue ratio: content inside Chinese quotes 「」『』"" ""
  const dialogueRegex = /[""「」『』]([^""「」『』]*)[""「」『』]/g;
  let dialogueChars = 0;
  let match: RegExpExecArray | null;
  while ((match = dialogueRegex.exec(plain)) !== null) {
    dialogueChars += match[1].length;
  }
  const dialogueRatio =
    totalChars > 0 ? Math.round((dialogueChars / totalChars) * 100) : 0;

  // Vocabulary diversity: unique chars / total chars (excluding whitespace and punctuation)
  const contentChars = plain.replace(
    /[\s\n\r\t。，、；：？！""''「」『』（）【】《》—…·\-.]/g,
    ""
  );
  const uniqueChars = new Set(contentChars).size;
  const vocabularyDiversity =
    contentChars.length > 0
      ? Math.round((uniqueChars / contentChars.length) * 100)
      : 0;

  // Rhythm score: standard deviation of paragraph lengths (higher = more variation)
  const stdDev = standardDeviation(paragraphLengths);
  // Normalize to 1-10: stdDev 0-50 maps to 1-10
  const rhythmScore = Math.round(
    Math.min(10, Math.max(1, 1 + (stdDev / 50) * 9))
  );

  return {
    readabilityScore,
    avgParagraphLength: Math.round(avgParagraphLength),
    longestParagraph,
    shortestParagraph,
    dialogueRatio,
    vocabularyDiversity,
    rhythmScore,
    paragraphLengths,
  };
}

function standardDeviation(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squaredDiffs = values.map((v) => Math.pow(v - mean, 2));
  return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / values.length);
}
