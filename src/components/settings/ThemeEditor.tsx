import { useState } from 'react';
import { useUiStore, type CustomTheme } from '@/stores/uiStore';

const BUILTIN_THEMES: Array<{ id: string; name: string; preview: string }> = [
  { id: 'dark', name: '深色', preview: '#1c1c2e' },
  { id: 'light', name: '浅色', preview: '#fafafa' },
  { id: 'sepia', name: '护眼', preview: '#f0e8d0' },
  { id: 'midnight', name: '午夜蓝', preview: '#0d1525' },
  { id: 'forest', name: '森林绿', preview: '#0d1a14' },
  { id: 'rose', name: '玫瑰', preview: '#1c0d14' },
  { id: 'cyberpunk', name: '赛博朋克', preview: '#12001e' },
];

const DEFAULT_COLORS: CustomTheme['colors'] = {
  primary: '#7c3aed',
  surface0: '#111111',
  surface1: '#1a1a1a',
  surface2: '#222222',
  surface3: '#2a2a2a',
  textPrimary: '#f0f0f0',
  textSecondary: '#b0b0b0',
  textMuted: '#707070',
  border: '#333333',
};

const COLOR_LABELS: Record<keyof CustomTheme['colors'], string> = {
  primary: '主色',
  surface0: '背景色',
  surface1: '卡片色',
  surface2: '面板色',
  surface3: '悬停色',
  textPrimary: '正文色',
  textSecondary: '次要文字',
  textMuted: '辅助文字',
  border: '边框色',
};

export function ThemeEditor() {
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);
  const customThemes = useUiStore((s) => s.customThemes);
  const addCustomTheme = useUiStore((s) => s.addCustomTheme);
  const updateCustomTheme = useUiStore((s) => s.updateCustomTheme);
  const deleteCustomTheme = useUiStore((s) => s.deleteCustomTheme);

  const [showEditor, setShowEditor] = useState(false);
  const [editing, setEditing] = useState<CustomTheme | null>(null);
  const [name, setName] = useState('');
  const [colors, setColors] = useState<CustomTheme['colors']>({ ...DEFAULT_COLORS });
  const [colorScheme, setColorScheme] = useState<'dark' | 'light'>('dark');

  const handleNewTheme = () => {
    setEditing(null);
    setName('自定义主题');
    setColors({ ...DEFAULT_COLORS });
    setColorScheme('dark');
    setShowEditor(true);
  };

  const handleEditCustom = (ct: CustomTheme) => {
    setEditing(ct);
    setName(ct.name);
    setColors({ ...ct.colors });
    setColorScheme(ct.colorScheme);
    setShowEditor(true);
  };

  const handleSave = () => {
    if (!name.trim()) return;

    const themeData: CustomTheme = {
      id: editing?.id ?? `custom-${Date.now()}`,
      name: name.trim(),
      colors,
      colorScheme,
    };

    if (editing) {
      updateCustomTheme(themeData.id, themeData);
    } else {
      addCustomTheme(themeData);
      setTheme(`custom-${themeData.id}`);
    }
    setShowEditor(false);
  };

  const handleColorChange = (key: keyof CustomTheme['colors'], value: string) => {
    setColors((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-medium text-[var(--color-text-muted)]">主题</h3>
        <button
          onClick={handleNewTheme}
          className="text-[10px] text-[var(--color-primary)] hover:underline"
        >
          + 自定义
        </button>
      </div>

      {/* Built-in themes grid */}
      <div className="grid grid-cols-4 gap-2">
        {BUILTIN_THEMES.map((t) => (
          <button
            key={t.id}
            onClick={() => setTheme(t.id)}
            className={`flex flex-col items-center gap-1 rounded-lg border p-2 transition-colors ${
              theme === t.id
                ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10'
                : 'border-[var(--color-border)] hover:bg-[var(--color-surface-3)]'
            }`}
          >
            <div
              className="h-8 w-full rounded-md border border-[var(--color-border)]"
              style={{ backgroundColor: t.preview }}
            />
            <span className="text-[10px] text-[var(--color-text-secondary)]">{t.name}</span>
          </button>
        ))}
      </div>

      {/* Custom themes */}
      {customThemes.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[10px] text-[var(--color-text-muted)]">自定义主题</div>
          {customThemes.map((ct) => (
            <div
              key={ct.id}
              className={`flex items-center gap-2 rounded-lg border p-2 transition-colors ${
                theme === `custom-${ct.id}`
                  ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10'
                  : 'border-[var(--color-border)]'
              }`}
            >
              <button
                onClick={() => setTheme(`custom-${ct.id}`)}
                className="flex flex-1 items-center gap-2"
              >
                <div
                  className="h-6 w-6 rounded border border-[var(--color-border)]"
                  style={{ backgroundColor: ct.colors.primary }}
                />
                <span className="text-xs text-[var(--color-text-secondary)]">{ct.name}</span>
              </button>
              <div className="flex gap-1">
                <button
                  onClick={() => handleEditCustom(ct)}
                  className="rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-3)]"
                  title="编辑"
                >
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2">
                    <path d="M8.5 1.5l2 2-7 7H1.5V8.5l7-7z" />
                  </svg>
                </button>
                <button
                  onClick={() => deleteCustomTheme(ct.id)}
                  className="rounded p-1 text-[var(--color-text-muted)] hover:bg-red-500/10 hover:text-red-400"
                  title="删除"
                >
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2">
                    <path d="M2 2l8 8M10 2l-8 8" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Editor modal */}
      {showEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowEditor(false)}>
          <div
            className="w-full max-w-md rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4 shadow-2xl max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-3">
              {editing ? '编辑主题' : '新建自定义主题'}
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-[var(--color-text-muted)] mb-1">主题名称</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded border border-[var(--color-border)] bg-[var(--color-surface-1)] px-2 py-1.5 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-primary)]"
                />
              </div>

              <div>
                <label className="block text-xs text-[var(--color-text-muted)] mb-1">配色方案</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setColorScheme('dark')}
                    className={`rounded px-3 py-1 text-xs ${colorScheme === 'dark' ? 'bg-[var(--color-primary)]/20 text-[var(--color-primary)]' : 'text-[var(--color-text-muted)]'}`}
                  >
                    暗色
                  </button>
                  <button
                    onClick={() => setColorScheme('light')}
                    className={`rounded px-3 py-1 text-xs ${colorScheme === 'light' ? 'bg-[var(--color-primary)]/20 text-[var(--color-primary)]' : 'text-[var(--color-text-muted)]'}`}
                  >
                    亮色
                  </button>
                </div>
              </div>

              {/* Color pickers */}
              <div className="space-y-2">
                {(Object.keys(COLOR_LABELS) as Array<keyof CustomTheme['colors']>).map((key) => (
                  <div key={key} className="flex items-center gap-2">
                    <input
                      type="color"
                      value={colors[key]}
                      onChange={(e) => handleColorChange(key, e.target.value)}
                      className="h-7 w-10 cursor-pointer rounded border border-[var(--color-border)] bg-transparent"
                    />
                    <span className="text-xs text-[var(--color-text-secondary)]">{COLOR_LABELS[key]}</span>
                    <span className="text-[10px] text-[var(--color-text-muted)] font-mono">{colors[key]}</span>
                  </div>
                ))}
              </div>

              {/* Preview */}
              <div
                className="rounded-lg border border-[var(--color-border)] p-3 space-y-2"
                style={{ backgroundColor: colors.surface0 }}
              >
                <div className="text-xs font-medium" style={{ color: colors.textPrimary }}>预览文本</div>
                <div
                  className="rounded p-2"
                  style={{ backgroundColor: colors.surface2 }}
                >
                  <div className="text-xs" style={{ color: colors.textSecondary }}>面板内容</div>
                  <div className="text-[10px] mt-1" style={{ color: colors.textMuted }}>辅助文字</div>
                </div>
                <div className="flex gap-1">
                  <span
                    className="rounded px-2 py-0.5 text-[10px]"
                    style={{ backgroundColor: colors.primary, color: colors.textPrimary }}
                  >
                    按钮
                  </span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setShowEditor(false)}
                className="rounded px-3 py-1.5 text-xs text-[var(--color-text-muted)] hover:bg-[var(--color-surface-3)]"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                className="rounded bg-[var(--color-primary)] px-3 py-1.5 text-xs text-white hover:opacity-90"
              >
                {editing ? '更新' : '创建'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
