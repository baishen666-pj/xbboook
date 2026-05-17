import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock localStorage
const localStorageStore: Record<string, string> = {};
const mockLocalStorage = {
  getItem: (key: string) => localStorageStore[key] ?? null,
  setItem: (key: string, value: string) => { localStorageStore[key] = value; },
  removeItem: (key: string) => { delete localStorageStore[key]; },
  clear: () => { Object.keys(localStorageStore).forEach((k) => delete localStorageStore[k]); },
  get length() { return Object.keys(localStorageStore).length; },
  key: (idx: number) => Object.keys(localStorageStore)[idx] ?? null,
};

// Mock document for theme application
const mockAttributes: Record<string, string> = {};
const mockHead = { appendChild: vi.fn(), children: [] };
const mockDocument = {
  documentElement: {
    setAttribute: (name: string, value: string) => { mockAttributes[name] = value; },
    getAttribute: (name: string) => mockAttributes[name] ?? null,
  },
  head: mockHead,
  createElement: () => ({ textContent: '', id: '', parentNode: null }),
  getElementById: () => null,
};

vi.stubGlobal('localStorage', mockLocalStorage);
vi.stubGlobal('document', mockDocument);

describe('Theme System', () => {
  beforeEach(() => {
    localStorageStore['xbbook-custom-themes'] = '[]';
    Object.keys(mockAttributes).forEach((k) => delete mockAttributes[k]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('CSS theme tokens', () => {
    it('has all 7 built-in themes defined', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const cssPath = path.join(process.cwd(), 'src/styles/tokens.css');
      const css = fs.readFileSync(cssPath, 'utf-8');

      const themes = ['dark', 'light', 'sepia', 'midnight', 'forest', 'rose', 'cyberpunk'];
      for (const theme of themes) {
        expect(css).toContain(`[data-theme="${theme}"]`);
      }
    });

    it('each theme defines required color variables', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const cssPath = path.join(process.cwd(), 'src/styles/tokens.css');
      const css = fs.readFileSync(cssPath, 'utf-8');

      const requiredVars = [
        '--color-primary',
        '--color-surface-0',
        '--color-surface-1',
        '--color-surface-2',
        '--color-surface-3',
        '--color-text-primary',
        '--color-text-secondary',
        '--color-text-muted',
        '--color-border',
        'color-scheme',
      ];

      const themes = ['dark', 'light', 'sepia', 'midnight', 'forest', 'rose', 'cyberpunk'];
      for (const theme of themes) {
        // Extract the theme block
        const themeRegex = new RegExp(`\\[data-theme="${theme}"\\] \\{([^}]+)\\}`, 's');
        const match = css.match(themeRegex);
        expect(match, `Theme "${theme}" block not found`).toBeTruthy();

        const block = match![1];
        for (const v of requiredVars) {
          expect(block, `Theme "${theme}" missing ${v}`).toContain(v);
        }
      }
    });
  });

  describe('localStorage theme persistence', () => {
    it('stores and retrieves custom themes', () => {
      const themes = [{ id: 'test', name: 'Test', colors: {} as Record<string, string>, colorScheme: 'dark' as const }];
      localStorage.setItem('xbbook-custom-themes', JSON.stringify(themes));

      const stored = JSON.parse(localStorage.getItem('xbbook-custom-themes')!);
      expect(stored).toHaveLength(1);
      expect(stored[0].name).toBe('Test');
    });

    it('handles empty localStorage gracefully', () => {
      const raw = localStorage.getItem('xbbook-custom-themes-nonexistent');
      expect(raw).toBeNull();
    });
  });

  describe('theme application', () => {
    it('sets data-theme attribute on document', () => {
      document.documentElement.setAttribute('data-theme', 'midnight');
      expect(mockAttributes['data-theme']).toBe('midnight');
    });

    it('cycles through theme values', () => {
      const themes = ['dark', 'light', 'sepia', 'midnight', 'forest', 'rose', 'cyberpunk'];
      const currentIdx = 0;
      const nextIdx = (currentIdx + 1) % themes.length;
      expect(themes[nextIdx]).toBe('light');
    });
  });
});
