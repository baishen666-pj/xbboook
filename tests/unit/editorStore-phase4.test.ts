import { describe, it, expect, beforeEach } from 'vitest';
import { useEditorStore } from '../../src/stores/editorStore';

describe('editorStore - dirtyAt tracking', () => {
  beforeEach(() => {
    useEditorStore.getState().clearChapter();
  });

  it('should track dirtyAt when content changes', () => {
    useEditorStore.getState().openChapter('ch-1', 'initial');
    expect(useEditorStore.getState().dirtyAt).toBeNull();

    useEditorStore.getState().updateContent('modified');
    expect(useEditorStore.getState().isDirty).toBe(true);
    expect(useEditorStore.getState().dirtyAt).toBeTypeOf('number');
    expect(useEditorStore.getState().dirtyAt).toBeGreaterThan(0);
  });

  it('should reset dirtyAt on save', () => {
    useEditorStore.getState().openChapter('ch-1', 'content');
    useEditorStore.getState().updateContent('modified');
    expect(useEditorStore.getState().dirtyAt).not.toBeNull();

    useEditorStore.getState().saveContent();
    expect(useEditorStore.getState().dirtyAt).toBeNull();
    expect(useEditorStore.getState().isDirty).toBe(false);
  });

  it('should reset dirtyAt on markSaved', () => {
    useEditorStore.getState().openChapter('ch-1', 'content');
    useEditorStore.getState().updateContent('modified');
    useEditorStore.getState().markSaved();
    expect(useEditorStore.getState().dirtyAt).toBeNull();
    expect(useEditorStore.getState().isDirty).toBe(false);
  });

  it('should keep dirtyAt stable on subsequent updates', () => {
    useEditorStore.getState().openChapter('ch-1', 'content');
    useEditorStore.getState().updateContent('first');
    const firstDirtyAt = useEditorStore.getState().dirtyAt;

    useEditorStore.getState().updateContent('second');
    expect(useEditorStore.getState().dirtyAt).toBe(firstDirtyAt);
  });
});
