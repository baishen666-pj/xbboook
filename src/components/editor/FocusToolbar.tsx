import { useMemo, useCallback } from "react";
import { useUiStore } from "@/stores/uiStore";
import { useEditorStore } from "@/stores/editorStore";
import { countMixedText } from "@/lib/word-count";
import { WritingTimer } from "./WritingTimer";

export function FocusToolbar() {
  const content = useEditorStore((s) => s.content);
  const activeChapterId = useEditorStore((s) => s.activeChapterId);
  const focusEditorWidth = useUiStore((s) => s.focusEditorWidth);
  const focusFontSizeMultiplier = useUiStore((s) => s.focusFontSizeMultiplier);
  const setFocusEditorWidth = useUiStore((s) => s.setFocusEditorWidth);
  const setFocusFontSizeMultiplier = useUiStore((s) => s.setFocusFontSizeMultiplier);
  const exitFocusMode = useUiStore((s) => s.exitFocusMode);

  const currentStats = useMemo(() => countMixedText(content), [content]);

  const wider = useCallback(() => setFocusEditorWidth(focusEditorWidth + 60), [focusEditorWidth, setFocusEditorWidth]);
  const narrower = useCallback(() => setFocusEditorWidth(focusEditorWidth - 60), [focusEditorWidth, setFocusEditorWidth]);
  const bigger = useCallback(() => setFocusFontSizeMultiplier(focusFontSizeMultiplier + 0.1), [focusFontSizeMultiplier, setFocusFontSizeMultiplier]);
  const smaller = useCallback(() => setFocusFontSizeMultiplier(focusFontSizeMultiplier - 0.1), [focusFontSizeMultiplier, setFocusFontSizeMultiplier]);

  if (!activeChapterId) return null;

  return (
    <div
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-full bg-[var(--color-surface-2)]/80 px-4 py-2 text-[var(--text-xs)] text-[var(--color-text-muted)] shadow-[var(--shadow-lg)] backdrop-blur-sm transition-opacity duration-300"
      role="status"
    >
      {/* Word count */}
      <span className="font-mono tabular-nums">
        {currentStats.words.toLocaleString()} 字
      </span>

      <span className="text-[var(--color-border)]" aria-hidden="true">|</span>

      {/* Timer + daily goal */}
      <WritingTimer />

      <span className="text-[var(--color-border)]" aria-hidden="true">|</span>

      {/* Width controls */}
      <button
        onClick={narrower}
        className="rounded px-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
        aria-label="缩窄编辑器"
      >
        ↤
      </button>
      <button
        onClick={wider}
        className="rounded px-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
        aria-label="加宽编辑器"
      >
        ↦
      </button>

      {/* Font size controls */}
      <button
        onClick={smaller}
        className="rounded px-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
        aria-label="缩小字体"
      >
        A-
      </button>
      <button
        onClick={bigger}
        className="rounded px-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
        aria-label="放大字体"
      >
        A+
      </button>

      <span className="text-[var(--color-border)]" aria-hidden="true">|</span>

      {/* Exit */}
      <button
        onClick={exitFocusMode}
        className="rounded px-2 text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
        aria-label="退出专注模式"
      >
        ESC 退出
      </button>
    </div>
  );
}
