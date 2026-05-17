import { create } from "zustand";

type LeftTab = "chapters" | "characters" | "worldview" | "outline" | "versions" | "schedule" | "foreshadowing" | "snippets" | "arcs" | "consistency" | "timeline" | "board" | "scenes";
type Theme = "dark" | "light" | "sepia" | "midnight" | "forest" | "rose" | "cyberpunk";

export interface CustomTheme {
  id: string;
  name: string;
  colors: {
    primary: string;
    surface0: string;
    surface1: string;
    surface2: string;
    surface3: string;
    textPrimary: string;
    textSecondary: string;
    textMuted: string;
    border: string;
  };
  colorScheme: 'dark' | 'light';
}

const CUSTOM_THEMES_KEY = 'xbbook-custom-themes';

function loadCustomThemes(): CustomTheme[] {
  try {
    const raw = localStorage.getItem(CUSTOM_THEMES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCustomThemes(themes: CustomTheme[]): void {
  localStorage.setItem(CUSTOM_THEMES_KEY, JSON.stringify(themes));
}

function applyCustomTheme(theme: CustomTheme): void {
  const root = document.documentElement;
  root.setAttribute('data-theme', `custom-${theme.id}`);
  const style = document.getElementById('custom-theme-style') ?? document.createElement('style');
  style.id = 'custom-theme-style';
  style.textContent = `
    [data-theme="custom-${theme.id}"] {
      --color-primary: ${theme.colors.primary};
      --color-primary-hover: ${theme.colors.primary};
      --color-primary-active: ${theme.colors.primary};
      --color-primary-subtle: ${theme.colors.primary}33;
      --color-surface-0: ${theme.colors.surface0};
      --color-surface-1: ${theme.colors.surface1};
      --color-surface-2: ${theme.colors.surface2};
      --color-surface-3: ${theme.colors.surface3};
      --color-text-primary: ${theme.colors.textPrimary};
      --color-text-secondary: ${theme.colors.textSecondary};
      --color-text-muted: ${theme.colors.textMuted};
      --color-border: ${theme.colors.border};
      --color-border-subtle: ${theme.colors.border}88;
      color-scheme: ${theme.colorScheme};
    }
  `;
  if (!style.parentNode) document.head.appendChild(style);
}

interface UiState {
  leftPanelWidth: number;
  rightPanelWidth: number;
  isLeftPanelOpen: boolean;
  isRightPanelOpen: boolean;
  isFullscreen: boolean;
  isFocusMode: boolean;
  isReaderMode: boolean;
  activeLeftTab: LeftTab;
  theme: Theme | string;
  isSearchOpen: boolean;
  isCommandPaletteOpen: boolean;
  splitPane: boolean;
  splitChapterId: string | null;
  splitRatio: number;
  focusEditorWidth: number;
  focusFontSizeMultiplier: number;
  customThemes: CustomTheme[];
}

interface UiActions {
  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;
  toggleFullscreen: () => void;
  enterFocusMode: () => void;
  exitFocusMode: () => void;
  toggleFocusMode: () => void;
  enterReaderMode: () => void;
  exitReaderMode: () => void;
  toggleReaderMode: () => void;
  setActiveLeftTab: (tab: LeftTab) => void;
  setLeftPanelWidth: (width: number) => void;
  setRightPanelWidth: (width: number) => void;
  setTheme: (theme: Theme | string) => void;
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
  addCustomTheme: (theme: CustomTheme) => void;
  updateCustomTheme: (id: string, theme: Partial<CustomTheme>) => void;
  deleteCustomTheme: (id: string) => void;
}

const THEME_CYCLE: (Theme | string)[] = ["dark", "light", "sepia", "midnight", "forest", "rose", "cyberpunk"];

export const useUiStore = create<UiState & UiActions>((set, get) => ({
  leftPanelWidth: 280,
  rightPanelWidth: 360,
  isLeftPanelOpen: true,
  isRightPanelOpen: true,
  isFullscreen: false,
  isFocusMode: false,
  isReaderMode: false,
  activeLeftTab: "chapters",
  theme: "dark",
  isSearchOpen: false,
  isCommandPaletteOpen: false,
  splitPane: false,
  splitChapterId: null,
  splitRatio: 0.5,
  focusEditorWidth: 720,
  focusFontSizeMultiplier: 1.0,
  customThemes: loadCustomThemes(),

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

  enterReaderMode: () => set({ isReaderMode: true, isFocusMode: false, isLeftPanelOpen: false, isRightPanelOpen: false, isSearchOpen: false }),
  exitReaderMode: () => set({ isReaderMode: false }),
  toggleReaderMode: () =>
    set((state) => state.isReaderMode ? { isReaderMode: false } : { isReaderMode: true, isFocusMode: false, isLeftPanelOpen: false, isRightPanelOpen: false, isSearchOpen: false }),

  setActiveLeftTab: (tab) => set({ activeLeftTab: tab }),

  setLeftPanelWidth: (width) => set({ leftPanelWidth: width }),

  setRightPanelWidth: (width) => set({ rightPanelWidth: width }),

  setTheme: (theme) => {
    set({ theme });
    if (theme.startsWith('custom-')) {
      const customId = theme.replace('custom-', '');
      const ct = get().customThemes.find((t) => t.id === customId);
      if (ct) applyCustomTheme(ct);
    }
  },

  cycleTheme: () =>
    set((state) => {
      const allThemes = [...THEME_CYCLE, ...state.customThemes.map((t) => `custom-${t.id}`)];
      const idx = allThemes.indexOf(state.theme);
      const next = allThemes[(idx + 1) % allThemes.length];
      if (next.startsWith('custom-')) {
        const customId = next.replace('custom-', '');
        const ct = state.customThemes.find((t) => t.id === customId);
        if (ct) applyCustomTheme(ct);
      }
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

  addCustomTheme: (theme) => {
    const themes = [...get().customThemes, theme];
    saveCustomThemes(themes);
    set({ customThemes: themes });
  },

  updateCustomTheme: (id, updates) => {
    const themes = get().customThemes.map((t) => t.id === id ? { ...t, ...updates } : t);
    saveCustomThemes(themes);
    set({ customThemes: themes });
    if (get().theme === `custom-${id}`) {
      const updated = themes.find((t) => t.id === id);
      if (updated) applyCustomTheme(updated);
    }
  },

  deleteCustomTheme: (id) => {
    const themes = get().customThemes.filter((t) => t.id !== id);
    saveCustomThemes(themes);
    if (get().theme === `custom-${id}`) {
      set({ theme: 'dark', customThemes: themes });
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      set({ customThemes: themes });
    }
  },
}));

useUiStore.subscribe((state, prev) => {
  if (state.theme !== prev.theme) {
    document.documentElement.setAttribute("data-theme", state.theme);
  }
});

document.documentElement.setAttribute("data-theme", useUiStore.getState().theme);

// Apply saved custom theme on startup
const initTheme = useUiStore.getState().theme;
if (initTheme.startsWith('custom-')) {
  const customId = initTheme.replace('custom-', '');
  const ct = useUiStore.getState().customThemes.find((t) => t.id === customId);
  if (ct) applyCustomTheme(ct);
}

export type { Theme, LeftTab };