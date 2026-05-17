import { useState, useEffect, useRef } from "react";
import { useProjectStore } from "@/stores/projectStore";
import { useUiStore } from "@/stores/uiStore";
import { SaveIndicator } from "@/components/editor/SaveIndicator";
import { PreferencesPanel } from "@/components/settings/PreferencesPanel";
import { NetworkStatusIndicator } from "@/components/ui/NetworkStatusIndicator";
import { ExportDialog } from "@/components/project/ExportDialog";

export function TitleBar() {
  const currentProject = useProjectStore((s) => s.currentProject);
  const toggleFullscreen = useUiStore((s) => s.toggleFullscreen);
  const isFullscreen = useUiStore((s) => s.isFullscreen);
  const isFocusMode = useUiStore((s) => s.isFocusMode);
  const isReaderMode = useUiStore((s) => s.isReaderMode);
  const toggleFocusMode = useUiStore((s) => s.toggleFocusMode);
  const toggleReaderMode = useUiStore((s) => s.toggleReaderMode);
  const theme = useUiStore((s) => s.theme);
  const cycleTheme = useUiStore((s) => s.cycleTheme);
  const [showExport, setShowExport] = useState(false);
  const [showPrefs, setShowPrefs] = useState(false);
  const prefsRef = useRef<HTMLDivElement>(null);

  const themeIcon = theme === "dark" ? "🌙" : theme === "light" ? "☀️" : "📖";

  useEffect(() => {
    if (!showPrefs) return;
    function handleClick(e: MouseEvent) {
      if (showPrefs && prefsRef.current && !prefsRef.current.contains(e.target as Node)) {
        setShowPrefs(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showPrefs]);

  return (
    <header className="flex h-10 items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface-1)] px-4" role="banner">
      <div className="flex items-center gap-3">
        <span className="text-sm font-bold tracking-tight text-[var(--color-primary)]">
          xbboook
        </span>
        {currentProject && (
          <>
            <span className="text-[var(--color-text-muted)]" aria-hidden="true">/</span>
            <span className="text-sm text-[var(--color-text-primary)] truncate max-w-48">
              {currentProject.name}
            </span>
          </>
        )}
      </div>

      <div className="flex items-center gap-3">
        {/* Save indicator */}
        <SaveIndicator />

        {/* Network status */}
        <NetworkStatusIndicator />

        {/* Export */}
        {currentProject && (
          <button
            onClick={() => setShowExport(true)}
            className="rounded-[var(--radius-sm)] px-2 py-1 text-[var(--text-xs)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-3)] hover:text-[var(--color-text-primary)] transition-colors btn-hover-scale"
            aria-label="导出"
          >
            导出
          </button>
        )}

        {/* Settings */}
        <div ref={prefsRef} className="relative">
          <button
            onClick={() => setShowPrefs(!showPrefs)}
            className="rounded-[var(--radius-sm)] px-2 py-1 text-[var(--text-xs)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-3)] hover:text-[var(--color-text-primary)] transition-colors btn-hover-scale"
            title="设置"
            aria-label="偏好设置"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true">
              <circle cx="7" cy="7" r="2.5" />
              <path d="M7 1v2M7 11v2M1 7h2M11 7h2M2.5 2.5l1.4 1.4M10.1 10.1l1.4 1.4M2.5 11.5l1.4-1.4M10.1 3.9l1.4-1.4" />
            </svg>
          </button>
          {showPrefs && (
            <div className="absolute right-0 top-full mt-1 z-50 w-64 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-1)] shadow-lg animate-[fadeIn_150ms_var(--ease-out)]">
              <PreferencesPanel />
            </div>
          )}
        </div>

        {/* Theme toggle */}
        <button
          onClick={cycleTheme}
          className="rounded-[var(--radius-sm)] px-2 py-1 text-[var(--text-xs)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-3)] hover:text-[var(--color-text-primary)] transition-colors btn-hover-scale"
          title={`主题：${theme === "dark" ? "暗色" : theme === "light" ? "亮色" : "阅读"}（点击切换）`}
          aria-label={`切换主题，当前：${theme === "dark" ? "暗色" : theme === "light" ? "亮色" : "阅读模式"}`}
        >
          {themeIcon}
        </button>

        {/* Focus mode toggle */}
        <button
          onClick={toggleFocusMode}
          className={`rounded-[var(--radius-sm)] px-2 py-1 text-[var(--text-xs)] transition-colors btn-hover-scale ${
            isFocusMode
              ? "bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
              : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-3)] hover:text-[var(--color-text-primary)]"
          }`}
          title={isFocusMode ? "退出专注模式 (ESC)" : "专注模式"}
          aria-label={isFocusMode ? "退出专注模式" : "进入专注模式"}
          aria-pressed={isFocusMode}
        >
          {isFocusMode ? "退出专注" : "专注"}
        </button>

        {/* Reader mode toggle */}
        <button
          onClick={toggleReaderMode}
          className={`rounded-[var(--radius-sm)] px-2 py-1 text-[var(--text-xs)] transition-colors btn-hover-scale ${
            isReaderMode
              ? "bg-amber-500/10 text-amber-500"
              : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-3)] hover:text-[var(--color-text-primary)]"
          }`}
          title={isReaderMode ? "退出阅读模式 (Esc)" : "阅读模式 (Ctrl+Shift+R)"}
          aria-label={isReaderMode ? "退出阅读模式" : "进入阅读模式"}
          aria-pressed={isReaderMode}
        >
          阅读
        </button>

        <button
          onClick={toggleFullscreen}
          className="rounded-[var(--radius-sm)] p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-3)] hover:text-[var(--color-text-primary)] transition-colors duration-[var(--duration-fast)] btn-hover-scale touch-target"
          title={isFullscreen ? "退出全屏" : "全屏 (F11)"}
          aria-label={isFullscreen ? "退出全屏" : "全屏模式"}
        >
          {isFullscreen ? (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <path d="M2 10v4h4M14 6V2h-4M2 14l5-5M14 2L9 7" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <path d="M2 6V2h4M14 10v4h-4M2 2l5 5M14 14l-5-5" />
            </svg>
          )}
        </button>
      </div>

      {currentProject && (
        <ExportDialog
          isOpen={showExport}
          onClose={() => setShowExport(false)}
        />
      )}
    </header>
  );
}
