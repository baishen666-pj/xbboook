import { create } from "zustand";

type LeftTab = "chapters" | "characters" | "worldview" | "outline" | "versions" | "schedule" | "foreshadowing" | "snippets" | "arcs" | "consistency" | "timeline";
type Theme = "dark" | "light" | "sepia";

interface UiState {
  leftPanelWidth: number;
  rightPanelWidth: number;
  isLeftPanelOpen: boolean;
  isRightPanelOpen: boolean;
  isFullscreen: boolean;
  isFocusMode: boolean;
  activeLeftTab: LeftTab;
  theme: Theme;
  isSearchOpen: boolean;
  isCommandPaletteOpen: boolean;
  splitPane: boolean;
  splitChapterId: string | null;
  splitRatio: number;
  focusEditorWidth: number;
  focusFontSizeMultiplier: number;
}

interface UiActions {
  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;
  toggleFullscreen: () => void;
  enterFocusMode: () => void;
  exitFocusMode: () => void;
  toggleFocusMode: () => void;
  setActiveLeftTab: (tab: LeftTab) => void;
  setLeftPanelWidth: (width: number) => void;
  setRightPanelWidth: (width: number) => void;
  setTheme: (theme: Theme) => void;
  cycleTheme: () => void;
  toggleSearch: () => void;
  closeSearch: () => void;
  toggleCommandPalette: () => void;
  closeCommandPalette: () => void;
  toggleSplitPane: () => void;
  setSplitChapterId: (id: string | null) => void;
  setSplitRatio: (ratio: number) => void;
  setFocusEditorWidth: (width: number) => void;
  setFocusFontSizeMultiplier: (multiplier: number) => void;
}

const THEME_CYCLE: Theme[] = ["dark", "light", "sepia"];

export const useUiStore = create<UiState & UiActions>((set) => ({
  leftPanelWidth: 280,
  rightPanelWidth: 360,
  isLeftPanelOpen: true,
  isRightPanelOpen: true,
  isFullscreen: false,
  isFocusMode: false,
  activeLeftTab: "chapters",
  theme: "dark",
  isSearchOpen: false,
  isCommandPaletteOpen: false,
  splitPane: false,
  splitChapterId: null,
  splitRatio: 0.5,
  focusEditorWidth: 720,
  focusFontSizeMultiplier: 1.0,

  toggleLeftPanel: () =>
    set((state) => ({ isLeftPanelOpen: !state.isLeftPanelOpen })),

  toggleRightPanel: () =>
    set((state) => ({ isRightPanelOpen: !state.isRightPanelOpen })),

  toggleFullscreen: () =>
    set((state) => ({ isFullscreen: !state.isFullscreen })),

  enterFocusMode: () => set({ isFocusMode: true, isLeftPanelOpen: false, isRightPanelOpen: false, isSearchOpen: false }),

  exitFocusMode: () => set({ isFocusMode: false }),

  toggleFocusMode: () =>
    set((state) => state.isFocusMode ? { isFocusMode: false } : { isFocusMode: true, isLeftPanelOpen: false, isRightPanelOpen: false, isSearchOpen: false }),

  setActiveLeftTab: (tab) => set({ activeLeftTab: tab }),

  setLeftPanelWidth: (width) => set({ leftPanelWidth: width }),

  setRightPanelWidth: (width) => set({ rightPanelWidth: width }),

  setTheme: (theme) => set({ theme }),

  cycleTheme: () =>
    set((state) => {
      const idx = THEME_CYCLE.indexOf(state.theme);
      const next = THEME_CYCLE[(idx + 1) % THEME_CYCLE.length] as Theme;
      return { theme: next };
    }),

  toggleSearch: () => set((state) => ({ isSearchOpen: !state.isSearchOpen })),

  closeSearch: () => set({ isSearchOpen: false }),

  toggleCommandPalette: () => set((state) => ({ isCommandPaletteOpen: !state.isCommandPaletteOpen })),

  closeCommandPalette: () => set({ isCommandPaletteOpen: false }),

  toggleSplitPane: () =>
    set((state) => ({
      splitPane: !state.splitPane,
      splitChapterId: state.splitPane ? null : state.splitChapterId,
    })),

  setSplitChapterId: (id) => set({ splitChapterId: id }),

  setSplitRatio: (ratio) => set({ splitRatio: Math.min(0.8, Math.max(0.2, ratio)) }),

  setFocusEditorWidth: (width) => set({ focusEditorWidth: Math.min(1200, Math.max(480, width)) }),
  setFocusFontSizeMultiplier: (multiplier) => set({ focusFontSizeMultiplier: Math.min(1.5, Math.max(0.8, multiplier)) }),
}));

useUiStore.subscribe((state, prev) => {
  if (state.theme !== prev.theme) {
    document.documentElement.setAttribute("data-theme", state.theme);
  }
});

document.documentElement.setAttribute("data-theme", useUiStore.getState().theme);