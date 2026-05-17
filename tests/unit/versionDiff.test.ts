import { describe, it, expect } from 'vitest';
import { computeCharDiff } from '../../src/components/version/VersionDiff';

describe('computeCharDiff', () => {
  it('returns same for identical strings', () => {
    const parts = computeCharDiff('你好世界', '你好世界');
    expect(parts).toHaveLength(1);
    expect(parts[0]).toEqual({ type: 'same', text: '你好世界' });
  });

  it('detects full replacement', () => {
    const parts = computeCharDiff('abc', 'xyz');
    expect(parts.some((p) => p.type === 'remove')).toBe(true);
    expect(parts.some((p) => p.type === 'add')).toBe(true);
  });

  it('detects Chinese character insertion', () => {
    const parts = computeCharDiff('你好', '你好好');
    const addParts = parts.filter((p) => p.type === 'add');
    expect(addParts.length).toBeGreaterThan(0);
    expect(addParts.some((p) => p.text.includes('好'))).toBe(true);
  });

  it('detects Chinese character deletion', () => {
    const parts = computeCharDiff('你好好', '你好');
    const removeParts = parts.filter((p) => p.type === 'remove');
    expect(removeParts.length).toBeGreaterThan(0);
  });

  it('merges adjacent same-type parts', () => {
    const parts = computeCharDiff('abcdef', 'abcxyz');
    // Should not have two consecutive same-type parts
    for (let i = 1; i < parts.length; i++) {
      expect(parts[i]!.type === parts[i - 1]!.type).toBe(false);
    }
  });

  it('respects 2000 char cap', () => {
    const longA = 'a'.repeat(3000);
    const longB = 'b'.repeat(3000);
    const parts = computeCharDiff(longA, longB);
    // Should not hang and should produce some result
    expect(parts.length).toBeGreaterThan(0);
    const totalLen = parts.reduce((sum, p) => sum + p.text.length, 0);
    expect(totalLen).toBeLessThanOrEqual(4000); // capped at 2000+2000
  });

  it('handles mixed CJK and ASCII', () => {
    const parts = computeCharDiff('Hello 世界', 'Hello 宇宙');
    const addParts = parts.filter((p) => p.type === 'add');
    const removeParts = parts.filter((p) => p.type === 'remove');
    expect(addParts.length + removeParts.length).toBeGreaterThan(0);
    expect(parts.some((p) => p.type === 'same' && p.text.includes('Hello'))).toBe(true);
  });
});
