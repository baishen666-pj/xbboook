import { describe, it, expect } from 'vitest';
import { buildPrompt, buildUserPrompt, toMessages } from '../../server/ai/promptBuilder.js';

describe('promptBuilder', () => {
  describe('buildPrompt', () => {
    it('throws for unknown skill', () => {
      expect(() => buildPrompt({
        skillId: 'unknown',
        sources: [],
        userMessage: 'test',
      })).toThrow('Unknown skill: unknown');
    });

    it('builds system prompt with skill + global suffix', () => {
      const result = buildPrompt({
        skillId: 'continue',
        sources: [],
        userMessage: '请续写',
      });
      expect(result.system).toContain('网文作者');
      expect(result.system).toContain('重要规则');
      expect(result.user).toBe('请续写');
    });

    it('includes context sources in system prompt', () => {
      const result = buildPrompt({
        skillId: 'continue',
        sources: [
          { priority: 10, label: '选中内容', content: '测试文本' },
        ],
        userMessage: '请续写',
      });
      expect(result.system).toContain('参考资料');
      expect(result.system).toContain('测试文本');
    });

    it('includes custom instruction', () => {
      const result = buildPrompt({
        skillId: 'continue',
        sources: [],
        userMessage: '请续写',
        customInstruction: '保持热血风格',
      });
      expect(result.system).toContain('额外指令');
      expect(result.system).toContain('保持热血风格');
    });

    it('omits context section when no sources', () => {
      const result = buildPrompt({
        skillId: 'continue',
        sources: [],
        userMessage: '请续写',
      });
      expect(result.system).not.toContain('参考资料');
    });
  });

  describe('buildUserPrompt', () => {
    it('continue skill includes chapter title', () => {
      const prompt = buildUserPrompt('continue', { currentChapterTitle: '第三章' });
      expect(prompt).toContain('第三章');
    });

    it('continue skill handles missing chapter title', () => {
      const prompt = buildUserPrompt('continue', {});
      expect(prompt).toContain('未知');
    });

    it('rewrite skill includes selected text', () => {
      const prompt = buildUserPrompt('rewrite', { selectedText: '选中的文本' });
      expect(prompt).toContain('选中的文本');
    });

    it('style skill includes target style', () => {
      const prompt = buildUserPrompt('style', { selectedText: '文本', targetStyle: '热血' });
      expect(prompt).toContain('热血');
    });

    it('qa skill uses question param', () => {
      const prompt = buildUserPrompt('qa', { question: '主角为什么变强？' });
      expect(prompt).toBe('主角为什么变强？');
    });

    it('qa skill falls back to default', () => {
      const prompt = buildUserPrompt('qa', {});
      expect(prompt).toBe('请回答我的问题');
    });

    it('deai skill includes selected text', () => {
      const prompt = buildUserPrompt('deai', { selectedText: '机械的AI文本' });
      expect(prompt).toContain('机械的AI文本');
      expect(prompt).toContain('去AI味');
    });
  });

  describe('toMessages', () => {
    it('converts prompt to chat message array', () => {
      const messages = toMessages({ system: 'sys', user: 'usr' });
      expect(messages).toEqual([
        { role: 'system', content: 'sys' },
        { role: 'user', content: 'usr' },
      ]);
    });
  });
});
