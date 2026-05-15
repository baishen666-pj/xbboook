import { describe, it, expect } from 'vitest';
import { countMixedText } from '../../src/lib/word-count';

describe('countMixedText', () => {
  it('should count English words', () => {
    const result = countMixedText('Hello world this is a test');
    expect(result.words).toBe(6);
  });

  it('should count Chinese characters as words', () => {
    const result = countMixedText('你好世界测试');
    expect(result.characters).toBe(6); // 6 CJK chars
    expect(result.words).toBe(6);      // 6 CJK chars + 0 English words
  });

  it('should handle mixed Chinese and English', () => {
    const result = countMixedText('Hello 你好 World 世界');
    expect(result.characters).toBe(4); // 4 CJK chars
    expect(result.words).toBe(6);      // 4 CJK + 2 English words
  });

  it('should count CJK characters only in characters field', () => {
    const result = countMixedText('Hello');
    expect(result.characters).toBe(0); // no CJK chars
    expect(result.words).toBe(1);      // 0 CJK + 1 English word
  });

  it('should count paragraphs', () => {
    const result = countMixedText('Para 1\n\nPara 2\n\nPara 3');
    expect(result.paragraphs).toBe(3);
  });

  it('should handle empty string', () => {
    const result = countMixedText('');
    expect(result.words).toBe(0);
    expect(result.characters).toBe(0);
    expect(result.paragraphs).toBe(0);
  });

  it('should handle whitespace only', () => {
    const result = countMixedText('   \n\n  \n  ');
    expect(result.words).toBe(0);
  });

  it('should count long Chinese text', () => {
    const text = '这是第一句话。这是第二句话，还有一些内容。';
    const result = countMixedText(text);
    expect(result.words).toBeGreaterThan(0);
    expect(result.characters).toBe(text.length);
  });
});
