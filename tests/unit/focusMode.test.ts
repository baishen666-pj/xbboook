/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';

// Mock document before importing
if (typeof document === 'undefined') {
  globalThis.document = { documentElement: { setAttribute: () => {} } } as any;
}

import { useUiStore } from '../../src/stores/uiStore';

describe('uiStore - focus mode', () => {
  beforeEach(() => {
    const s = useUiStore.getState();
    if (s.isFocusMode) s.exitFocusMode();
    if (!s.isLeftPanelOpen) s.toggleLeftPanel();
    if (!s.isRightPanelOpen) s.toggleRightPanel();
    if (s.isSearchOpen) s.closeSearch();
  });

  it('should have focus mode state and actions', () => {
    const state = useUiStore.getState();
    expect(state).toHaveProperty('isFocusMode');
    expect(state).toHaveProperty('enterFocusMode');
    expect(state).toHaveProperty('exitFocusMode');
    expect(state).toHaveProperty('toggleFocusMode');
    expect(typeof state.isFocusMode).toBe('boolean');
  });

  it('enterFocusMode should close panels and search', () => {
    const store = useUiStore;
    store.getState().toggleSearch();
    expect(store.getState().isSearchOpen).toBe(true);

    store.getState().enterFocusMode();
    expect(store.getState().isFocusMode).toBe(true);
    expect(store.getState().isLeftPanelOpen).toBe(false);
    expect(store.getState().isRightPanelOpen).toBe(false);
    expect(store.getState().isSearchOpen).toBe(false);
  });

  it('exitFocusMode should only clear focus mode', () => {
    useUiStore.getState().enterFocusMode();
    expect(useUiStore.getState().isFocusMode).toBe(true);

    useUiStore.getState().exitFocusMode();
    expect(useUiStore.getState().isFocusMode).toBe(false);
  });

  it('toggleFocusMode should toggle state', () => {
    expect(useUiStore.getState().isFocusMode).toBe(false);
    useUiStore.getState().toggleFocusMode();
    expect(useUiStore.getState().isFocusMode).toBe(true);
    useUiStore.getState().toggleFocusMode();
    expect(useUiStore.getState().isFocusMode).toBe(false);
  });
});
