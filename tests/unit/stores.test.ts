import { describe, it, expect, beforeEach } from 'vitest';
import { useEditorStore } from '../../src/stores/editorStore';

describe('editorStore', () => {
  beforeEach(() => {
    useEditorStore.setState({
      activeChapterId: null,
      content: '',
      selectedText: '',
      isDirty: false,
      lastSavedAt: null,
      isSaving: false,
    });
  });

  it('should open a chapter', () => {
    useEditorStore.getState().openChapter('ch-1', 'Hello world');

    const state = useEditorStore.getState();
    expect(state.activeChapterId).toBe('ch-1');
    expect(state.content).toBe('Hello world');
    expect(state.isDirty).toBe(false);
  });

  it('should mark dirty on content update', () => {
    useEditorStore.getState().openChapter('ch-1', '');
    useEditorStore.getState().updateContent('New content');

    expect(useEditorStore.getState().isDirty).toBe(true);
    expect(useEditorStore.getState().content).toBe('New content');
  });

  it('should track selected text', () => {
    useEditorStore.getState().setSelectedText('selected');

    expect(useEditorStore.getState().selectedText).toBe('selected');
  });

  it('should clear chapter', () => {
    useEditorStore.getState().openChapter('ch-1', 'content');
    useEditorStore.getState().clearChapter();

    const state = useEditorStore.getState();
    expect(state.activeChapterId).toBeNull();
    expect(state.content).toBe('');
  });

  it('should mark saved', () => {
    useEditorStore.getState().openChapter('ch-1', 'content');
    useEditorStore.getState().updateContent('changed');
    useEditorStore.getState().saveContent();
    useEditorStore.getState().markSaved();

    const state = useEditorStore.getState();
    expect(state.isDirty).toBe(false);
    expect(state.isSaving).toBe(false);
    expect(state.lastSavedAt).not.toBeNull();
  });
});
