import { useState } from "react";
import { usePreferenceStore } from "@/stores/preferenceStore";
import { useUiStore } from "@/stores/uiStore";
import { BackupPanel } from "./BackupPanel";
import { ThemeEditor } from "./ThemeEditor";

export function PreferencesPanel() {
  const [showBackup, setShowBackup] = useState(false);
  const preferences = usePreferenceStore((s) => s.preferences);
  const setPreference = usePreferenceStore((s) => s.setPreference);
  const focusEditorWidth = useUiStore((s) => s.focusEditorWidth);
  const setFocusEditorWidth = useUiStore((s) => s.setFocusEditorWidth);
  const focusFontSizeMultiplier = useUiStore((s) => s.focusFontSizeMultiplier);
  const setFocusFontSizeMultiplier = useUiStore((s) => s.setFocusFontSizeMultiplier);

  const autoSaveInterval = preferences.autoSaveInterval ?? "1000";
  const defaultAiTemperature = preferences.defaultAiTemperature ?? "0.7";

  return (
    <div className="space-y-6 p-4">
      <h2 className="text-sm font-semibold text-[var(--color-text-secondary)]">偏好设置</h2>

      {/* Editor */}
      <section className="space-y-3">
        <h3 className="text-xs font-medium text-[var(--color-text-muted)]">编辑器</h3>

        <label className="flex items-center justify-between gap-4">
          <span className="text-xs text-[var(--color-text-secondary)]">自动保存间隔</span>
          <select
            value={autoSaveInterval}
            onChange={(e) => setPreference("autoSaveInterval", e.target.value)}
            className="rounded border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 py-1 text-xs text-[var(--color-text-secondary)]"
          >
            <option value="500">0.5 秒</option>
            <option value="1000">1 秒</option>
            <option value="3000">3 秒</option>
            <option value="5000">5 秒</option>
          </select>
        </label>

        <label className="flex items-center justify-between gap-4">
          <span className="text-xs text-[var(--color-text-secondary)]">专注模式宽度</span>
          <span className="text-xs text-[var(--color-text-muted)]">{focusEditorWidth}px</span>
        </label>
        <input
          type="range"
          min={480}
          max={1200}
          step={60}
          value={focusEditorWidth}
          onChange={(e) => setFocusEditorWidth(Number(e.target.value))}
          className="w-full"
        />

        <label className="flex items-center justify-between gap-4">
          <span className="text-xs text-[var(--color-text-secondary)]">专注模式字号</span>
          <span className="text-xs text-[var(--color-text-muted)]">{focusFontSizeMultiplier.toFixed(1)}x</span>
        </label>
        <input
          type="range"
          min={0.8}
          max={1.5}
          step={0.1}
          value={focusFontSizeMultiplier}
          onChange={(e) => setFocusFontSizeMultiplier(Number(e.target.value))}
          className="w-full"
        />
      </section>

      {/* AI */}
      <section className="space-y-3">
        <h3 className="text-xs font-medium text-[var(--color-text-muted)]">AI</h3>

        <label className="flex items-center justify-between gap-4">
          <span className="text-xs text-[var(--color-text-secondary)]">默认温度</span>
          <select
            value={defaultAiTemperature}
            onChange={(e) => setPreference("defaultAiTemperature", e.target.value)}
            className="rounded border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 py-1 text-xs text-[var(--color-text-secondary)]"
          >
            <option value="0.3">0.3（精确）</option>
            <option value="0.5">0.5</option>
            <option value="0.7">0.7（默认）</option>
            <option value="0.9">0.9（创意）</option>
            <option value="1.0">1.0（最大创意）</option>
          </select>
        </label>
      </section>

      {/* Appearance */}
      <section className="space-y-3">
        <h3 className="text-xs font-medium text-[var(--color-text-muted)]">外观</h3>
        <ThemeEditor />
      </section>

      {/* Backup */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-medium text-[var(--color-text-muted)]">数据备份</h3>
          <button
            onClick={() => setShowBackup(!showBackup)}
            className="text-[10px] text-[var(--color-primary)] hover:underline"
          >
            {showBackup ? "收起" : "管理备份"}
          </button>
        </div>
        {showBackup && <BackupPanel />}
      </section>
    </div>
  );
}
