import { create } from "zustand";

type LeftTab = "chapters" | "characters" | "worldview" | "outline" | "versions" | "schedule" | "foreshadowing" | "snippets";
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
  splitPane: boolean;
  splitChapterId: string | null;
  splitRatio: number;
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
  toggleSplitPane: () => void;
  setSplitChapterId: (id: string | null) => void;
  setSplitRatio: (ratio: number) => void;
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
  splitPane: false,
  splitChapterId: null,
  splitRatio: 0.5,

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

  toggleSplitPane: () =>
    set((state) => ({
      splitPane: !state.splitPane,
      splitChapterId: state.splitPane ? null : state.splitChapterId,
    })),

  setSplitChapterId: (id) => set({ splitChapterId: id }),

  setSplitRatio: (ratio) => set({ splitRatio: Math.min(0.8, Math.max(0.2, ratio)) }),
}));

useUiStore.subscribe((state, prev) => {
  if (state.theme !== prev.theme) {
    document.documentElement.setAttribute("data-theme", state.theme);
  }
});

document.documentElement.setAttribute("data-theme", useUiStore.getState().theme);