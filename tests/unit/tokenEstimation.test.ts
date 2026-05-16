import { describe, it, expect } from 'vitest';
import { estimateTokens } from '../../server/ai/contextBuilder.js';

describe('estimateTokens', () => {
  it('returns 0 for empty string', () => {
    expect(estimateTokens('')).toBe(0);
  });

  it('estimates ASCII text at ~4 chars/token', () => {
    const text = 'Hello world this is a test of English text';
    const tokens = estimateTokens(text);
    const ratio = text.length / tokens;
    expect(ratio).toBeGreaterThan(3);
    expect(ratio).toBeLessThan(5);
  });

  it('estimates Chinese text at ~1.5 chars/token', () => {
    const text = '张三走进了山谷发现了一个神秘的洞穴';
    const tokens = estimateTokens(text);
    const ratio = text.length / tokens;
    expect(ratio).toBeGreaterThan(1);
    expect(ratio).toBeLessThan(2);
  });

  it('estimates mixed CJK+ASCII text between the two ratios', () => {
    const text = '张三走进了Valley发现了一个mysterious洞穴';
    const tokens = estimateTokens(text);
    const ratio = text.length / tokens;
    expect(ratio).toBeGreaterThan(1);
    expect(ratio).toBeLessThan(5);
  });

  it('pure Chinese has lower chars/token than pure English', () => {
    const chinese = '这是一个纯中文的测试文本用来验证';
    const english = 'This is a pure English test text for verification';
    const chineseRatio = chinese.length / estimateTokens(chinese);
    const englishRatio = english.length / estimateTokens(english);
    expect(chineseRatio).toBeLessThan(englishRatio);
  });

  it('handles long Chinese text without overflow', () => {
    const text = '这是一段很长的中文文本'.repeat(100);
    const tokens = estimateTokens(text);
    expect(tokens).toBeGreaterThan(0);
    expect(tokens).toBeLessThan(text.length);
  });
});