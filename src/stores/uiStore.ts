import { create } from "zustand";

type LeftTab = "chapters" | "characters" | "worldview" | "outline" | "versions";
type Theme = "dark" | "light" | "sepia";

interface UiState {
  leftPanelWidth: number;
  rightPanelWidth: number;
  isLeftPanelOpen: boolean;
  isRightPanelOpen: boolean;
  isFullscreen: boolean;
  activeLeftTab: LeftTab;
  theme: Theme;
  isSearchOpen: boolean;
}

interface UiActions {
  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;
  toggleFullscreen: () => void;
  setActiveLeftTab: (tab: LeftTab) => void;
  setLeftPanelWidth: (width: number) => void;
  setRightPanelWidth: (width: number) => void;
  setTheme: (theme: Theme) => void;
  cycleTheme: () => void;
  toggleSearch: () => void;
  closeSearch: () => void;
}

const THEME_CYCLE: Theme[] = ["dark", "light", "sepia"];

export const useUiStore = create<UiState & UiActions>((set) => ({
  leftPanelWidth: 280,
  rightPanelWidth: 360,
  isLeftPanelOpen: true,
  isRightPanelOpen: true,
  isFullscreen: false,
  activeLeftTab: "chapters",
  theme: "dark",
  isSearchOpen: false,

  toggleLeftPanel: () =>
    set((state) => ({ isLeftPanelOpen: !state.isLeftPanelOpen })),

  toggleRightPanel: () =>
    set((state) => ({ isRightPanelOpen: !state.isRightPanelOpen })),

  toggleFullscreen: () =>
    set((state) => ({ isFullscreen: !state.isFullscreen })),

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
}));

useUiStore.subscribe((state, prev) => {
  if (state.theme !== prev.theme) {
    document.documentElement.setAttribute("data-theme", state.theme);
  }
});

document.documentElement.setAttribute("data-theme", useUiStore.getState().theme);
