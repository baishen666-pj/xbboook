import { describe, it, expect } from "vitest";
import { analyzeContent } from "../../server/services/contentAnalysis.js";

describe("analyzeContent", () => {
  it("returns zeros for empty string", () => {
    const result = analyzeContent("");
    expect(result.readabilityScore).toBe(0);
    expect(result.avgParagraphLength).toBe(0);
    expect(result.dialogueRatio).toBe(0);
    expect(result.vocabularyDiversity).toBe(0);
    expect(result.paragraphLengths).toEqual([]);
  });

  it("returns zeros for HTML with no text", () => {
    const result = analyzeContent("<p></p><br/>");
    expect(result.readabilityScore).toBe(0);
  });

  it("strips HTML tags before analysis", () => {
    const result = analyzeContent("<p>这是第一段。</p><p>这是第二段。</p>");
    expect(result.paragraphLengths.length).toBeGreaterThan(0);
    expect(result.readabilityScore).toBeGreaterThan(0);
  });

  it("computes paragraph lengths correctly", () => {
    const result = analyzeContent("短段落。\n\n这是一个稍微长一点的段落，包含更多的字符，用于测试段落长度分析功能。");
    expect(result.paragraphLengths).toHaveLength(2);
    expect(result.shortestParagraph).toBeLessThan(result.longestParagraph);
  });

  it("computes readability score between 1 and 10", () => {
    const text = "这是一个测试句子。包含一些中文内容。用于评估可读性指标。";
    const result = analyzeContent(text);
    expect(result.readabilityScore).toBeGreaterThanOrEqual(1);
    expect(result.readabilityScore).toBeLessThanOrEqual(10);
  });

  it("detects dialogue with Chinese quotes", () => {
    const text = '他说：「你好世界」。然后走了。';
    const result = analyzeContent(text);
    expect(result.dialogueRatio).toBeGreaterThan(0);
  });

  it("detects dialogue with double quotes", () => {
    const text = '他说："你好世界"。然后走了。';
    const result = analyzeContent(text);
    expect(result.dialogueRatio).toBeGreaterThan(0);
  });

  it("returns zero dialogue ratio when no quotes present", () => {
    const text = "这是一段没有对话的纯叙述文本。";
    const result = analyzeContent(text);
    expect(result.dialogueRatio).toBe(0);
  });

  it("computes vocabulary diversity as percentage", () => {
    const text = "独特的字符组合。";
    const result = analyzeContent(text);
    expect(result.vocabularyDiversity).toBeGreaterThan(0);
    expect(result.vocabularyDiversity).toBeLessThanOrEqual(100);
  });

  it("returns high vocabulary diversity for varied text", () => {
    const text = "春花秋月何时了，往事知多少。小楼昨夜又东风，故国不堪回首月明中。";
    const result = analyzeContent(text);
    expect(result.vocabularyDiversity).toBeGreaterThan(50);
  });

  it("computes rhythm score between 1 and 10", () => {
    const text = "短。\n\n这是一段中等长度的段落，大约四五十个字符左右吧。\n\n这是一段非常非常长的段落，包含很多很多的内容，以至于它比其他段落都要长得多得多，用来测试节奏分数的计算是否正确，以及标准差是否能够反映段落长度的变化程度。";
    const result = analyzeContent(text);
    expect(result.rhythmScore).toBeGreaterThanOrEqual(1);
    expect(result.rhythmScore).toBeLessThanOrEqual(10);
  });

  it("reports average paragraph length", () => {
    const text = "这是一个段。\n\n另一个段。";
    const result = analyzeContent(text);
    expect(result.avgParagraphLength).toBeGreaterThan(0);
  });

  it("handles HTML entities", () => {
    const result = analyzeContent("<p>Hello &amp; world。这是测试。</p>");
    expect(result.readabilityScore).toBeGreaterThan(0);
    expect(result.paragraphLengths.length).toBeGreaterThan(0);
  });

  it("handles single paragraph", () => {
    const result = analyzeContent("这是唯一的一个段落。包含一些句子。测试用。");
    expect(result.paragraphLengths).toHaveLength(1);
    expect(result.longestParagraph).toBe(result.shortestParagraph);
  });

  it("computes correct shortest and longest paragraph", () => {
    const result = analyzeContent("短。\n\n这是中等长度的段落内容。\n\n这是最长的段落内容，包含了很多的字符和文字，确保它比其他段落都要长很多很多很多很多。");
    expect(result.shortestParagraph).toBeLessThan(result.longestParagraph);
    expect(result.longestParagraph).toBeGreaterThan(result.avgParagraphLength);
  });

  it("handles text with only whitespace", () => {
    const result = analyzeContent("   \n\n  \n  ");
    expect(result.readabilityScore).toBe(0);
  });
});
