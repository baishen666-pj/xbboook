interface WordCountResult {
  characters: number;
  words: number;
  paragraphs: number;
}

const CJK_RANGE = /[一-鿿㐀-䶿　-〿＀-￯]/;

function isCJK(char: string): boolean {
  return CJK_RANGE.test(char);
}

export function countMixedText(text: string): WordCountResult {
  if (!text || text.trim().length === 0) {
    return { characters: 0, words: 0, paragraphs: 0 };
  }

  let characters = 0;
  let englishWords = 0;
  let inEnglishWord = false;

  for (const char of text) {
    if (isCJK(char)) {
      characters += 1;
      if (inEnglishWord) {
        englishWords += 1;
        inEnglishWord = false;
      }
    } else if (/\s/.test(char)) {
      if (inEnglishWord) {
        englishWords += 1;
        inEnglishWord = false;
      }
    } else {
      inEnglishWord = true;
    }
  }

  if (inEnglishWord) {
    englishWords += 1;
  }

  const paragraphs = text
    .split(/\n+/)
    .filter((line) => line.trim().length > 0).length;

  return {
    characters,
    words: characters + englishWords,
    paragraphs,
  };
}
