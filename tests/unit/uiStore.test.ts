/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useUiStore } from '@/stores/uiStore';

describe('uiStore', () => {
  beforeEach(() => {
    useUiStore.setState({
      leftPanelWidth: 280,
      rightPanelWidth: 360,
      isLeftPanelOpen: true,
      isRightPanelOpen: true,
      isFullscreen: false,
      activeLeftTab: 'chapters',
      theme: 'dark',
    });
  });

  describe('toggleLeftPanel', () => {
    it('toggles left panel open state', () => {
      expect(useUiStore.getState().isLeftPanelOpen).toBe(true);
      useUiStore.getState().toggleLeftPanel();
      expect(useUiStore.getState().isLeftPanelOpen).toBe(false);
      useUiStore.getState().toggleLeftPanel();
      expect(useUiStore.getState().isLeftPanelOpen).toBe(true);
    });
  });

  describe('toggleRightPanel', () => {
    it('toggles right panel open state', () => {
      expect(useUiStore.getState().isRightPanelOpen).toBe(true);
      useUiStore.getState().toggleRightPanel();
      expect(useUiStore.getState().isRightPanelOpen).toBe(false);
    });
  });

  describe('toggleFullscreen', () => {
    it('toggles fullscreen mode', () => {
      expect(useUiStore.getState().isFullscreen).toBe(false);
      useUiStore.getState().toggleFullscreen();
      expect(useUiStore.getState().isFullscreen).toBe(true);
    });
  });

  describe('setActiveLeftTab', () => {
    it('changes active left tab', () => {
      useUiStore.getState().setActiveLeftTab('characters');
      expect(useUiStore.getState().activeLeftTab).toBe('characters');
    });
  });

  describe('setTheme', () => {
    it('updates theme state', () => {
      useUiStore.getState().setTheme('light');
      expect(useUiStore.getState().theme).toBe('light');
    });
  });

  describe('cycleTheme', () => {
    it('cycles through themes dark→light→sepia→dark', () => {
      expect(useUiStore.getState().theme).toBe('dark');
      useUiStore.getState().cycleTheme();
      expect(useUiStore.getState().theme).toBe('light');
      useUiStore.getState().cycleTheme();
      expect(useUiStore.getState().theme).toBe('sepia');
      useUiStore.getState().cycleTheme();
      expect(useUiStore.getState().theme).toBe('dark');
    });
  });

  describe('panel widths', () => {
    it('updates left panel width', () => {
      useUiStore.getState().setLeftPanelWidth(400);
      expect(useUiStore.getState().leftPanelWidth).toBe(400);
    });

    it('updates right panel width', () => {
      useUiStore.getState().setRightPanelWidth(500);
      expect(useUiStore.getState().rightPanelWidth).toBe(500);
    });
  });
});
