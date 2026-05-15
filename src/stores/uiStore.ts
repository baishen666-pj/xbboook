import { create } from "zustand";

type LeftTab = "chapters" | "characters" | "worldview" | "outline";
type Theme = "dark" | "light" | "sepia";

interface UiState {
  leftPanelWidth: number;
  rightPanelWidth: number;
  isLeftPanelOpen: boolean;
  isRightPanelOpen: boolean;
  isFullscreen: boolean;
  activeLeftTab: LeftTab;
  theme: Theme;
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

  toggleLeftPanel: () =>
    set((state) => ({ isLeftPanelOpen: !state.isLeftPanelOpen })),

  toggleRightPanel: () =>
    set((state) => ({ isRightPanelOpen: !state.isRightPanelOpen })),

  toggleFullscreen: () =>
    set((state) => ({ isFullscreen: !state.isFullscreen })),

  setActiveLeftTab: (tab) => set({ activeLeftTab: tab }),

  setLeftPanelWidth: (width) => set({ leftPanelWidth: width }),

  setRightPanelWidth: (width) => set({ rightPanelWidth: width }),

  setTheme: (theme) => {
    document.documentElement.setAttribute("data-theme", theme);
    set({ theme });
  },

  cycleTheme: () =>
    set((state) => {
      const idx = THEME_CYCLE.indexOf(state.theme);
      const next = THEME_CYCLE[(idx + 1) % THEME_CYCLE.length] as Theme;
      document.documentElement.setAttribute("data-theme", next);
      return { theme: next };
    }),
}));
