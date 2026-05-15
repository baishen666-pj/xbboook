import { describe, it, expect, beforeEach } from 'vitest';
import { useAiStore } from '../../src/stores/aiStore';

describe('aiStore', () => {
  beforeEach(() => {
    useAiStore.setState({
      isOpen: false,
      skills: [],
      activeSkillId: 'continue',
      messages: [],
      isStreaming: false,
      currentStreamContent: '',
      error: null,
    });
  });

  it('should toggle panel', () => {
    useAiStore.getState().togglePanel();
    expect(useAiStore.getState().isOpen).toBe(true);

    useAiStore.getState().togglePanel();
    expect(useAiStore.getState().isOpen).toBe(false);
  });

  it('should set active skill', () => {
    useAiStore.getState().setActiveSkill('polish');
    expect(useAiStore.getState().activeSkillId).toBe('polish');
  });

  it('should add and update messages', () => {
    const id = useAiStore.getState().addMessage({
      role: 'user',
      content: 'Hello',
      skillId: 'continue',
    });

    expect(useAiStore.getState().messages).toHaveLength(1);
    expect(useAiStore.getState().messages[0].content).toBe('Hello');

    useAiStore.getState().appendToMessage(id, ' World');
    expect(useAiStore.getState().messages[0].content).toBe('Hello World');
  });

  it('should manage streaming state', () => {
    useAiStore.getState().setStreaming(true);
    expect(useAiStore.getState().isStreaming).toBe(true);

    useAiStore.getState().appendStreamContent('chunk1');
    useAiStore.getState().appendStreamContent('chunk2');
    expect(useAiStore.getState().currentStreamContent).toBe('chunk1chunk2');

    useAiStore.getState().clearStreamContent();
    expect(useAiStore.getState().currentStreamContent).toBe('');
  });

  it('should clear messages', () => {
    useAiStore.getState().addMessage({ role: 'user', content: 'test', skillId: 'qa' });
    useAiStore.getState().clearMessages();

    expect(useAiStore.getState().messages).toHaveLength(0);
  });
});
