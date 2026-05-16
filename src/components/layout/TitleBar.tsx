import { useState, useEffect, useRef } from "react";
import { useProjectStore } from "@/stores/projectStore";
import { useUiStore } from "@/stores/uiStore";
import { SaveIndicator } from "@/components/editor/SaveIndicator";

export function TitleBar() {
  const currentProject = useProjectStore((s) => s.currentProject);
  const toggleFullscreen = useUiStore((s) => s.toggleFullscreen);
  const isFullscreen = useUiStore((s) => s.isFullscreen);
  const isFocusMode = useUiStore((s) => s.isFocusMode);
  const toggleFocusMode = useUiStore((s) => s.toggleFocusMode);
  const theme = useUiStore((s) => s.theme);
  const cycleTheme = useUiStore((s) => s.cycleTheme);
  const [showExport, setShowExport] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  const themeIcon = theme === "dark" ? "🌙" : theme === "light" ? "☀️" : "📖";

  useEffect(() => {
    if (!showExport) return;
    function handleClick(e: MouseEvent) {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setShowExport(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showExport]);

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

        {/* Export */}
        {currentProject && (
          <div className="relative" ref={exportRef}>
            <button
              onClick={() => setShowExport(!showExport)}
              className="rounded-[var(--radius-sm)] px-2 py-1 text-[var(--text-xs)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-3)] hover:text-[var(--color-text-primary)] transition-colors btn-hover-scale"
              aria-label="导出"
              aria-expanded={showExport}
              aria-haspopup="true"
            >
              导出
            </button>
            {showExport && (
              <div className="absolute right-0 top-full mt-1 z-20 w-44 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-1)] py-1 shadow-[var(--shadow-lg)] animate-[slideUp_150ms_var(--ease-out)]" role="menu" aria-label="导出格式">
                {[
                  { label: "TXT", path: "txt" },
                  { label: "Markdown", path: "md" },
                  { label: "EPUB", path: "epub" },
                  { label: "DOCX", path: "docx" },
                  { label: "PDF", path: "pdf" },
                ].map((fmt) => (
                  <a
                    key={fmt.path}
                    href={`/api/projects/${currentProject.id}/export/${fmt.path}`}
                    download
                    onClick={() => setShowExport(false)}
                    className="flex items-center justify-between px-3 py-1.5 text-[var(--text-xs)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-3)] hover:text-[var(--color-text-primary)] transition-colors"
                    role="menuitem"
                  >
                    导出 {fmt.label}
                    <span className="text-[10px] text-[var(--color-text-muted)]" aria-hidden="true">.{fmt.path === "md" ? "md" : fmt.path}</span>
                  </a>
                ))}
              </div>
            )}
          </div>
        )}

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
    </header>
  );
}
