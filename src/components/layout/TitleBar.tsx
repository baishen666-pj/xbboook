import { useState } from "react";
import { useProjectStore } from "@/stores/projectStore";
import { useUiStore } from "@/stores/uiStore";
import { useEditorStore } from "@/stores/editorStore";

export function TitleBar() {
  const currentProject = useProjectStore((s) => s.currentProject);
  const toggleFullscreen = useUiStore((s) => s.toggleFullscreen);
  const isFullscreen = useUiStore((s) => s.isFullscreen);
  const theme = useUiStore((s) => s.theme);
  const cycleTheme = useUiStore((s) => s.cycleTheme);
  const lastSavedAt = useEditorStore((s) => s.lastSavedAt);
  const isDirty = useEditorStore((s) => s.isDirty);
  const [showExport, setShowExport] = useState(false);

  const themeIcon = theme === "dark" ? "🌙" : theme === "light" ? "☀️" : "📖";

  const saveLabel = isDirty
    ? "编辑中..."
    : lastSavedAt
      ? `已保存于 ${lastSavedAt.toLocaleTimeString()}`
      : "就绪";

  return (
    <header className="flex h-10 items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface-1)] px-4">
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold text-[var(--color-primary)]">
          xbboook
        </span>
        {currentProject && (
          <>
            <span className="text-[var(--color-text-muted)]">/</span>
            <span className="text-sm text-[var(--color-text-primary)]">
              {currentProject.name}
            </span>
          </>
        )}
      </div>

      <div className="flex items-center gap-4">
        <span className="text-[var(--text-xs)] text-[var(--color-text-muted)]">
          {saveLabel}
        </span>

        {/* Export */}
        {currentProject && (
          <div className="relative">
            <button
              onClick={() => setShowExport(!showExport)}
              className="rounded-[var(--radius-sm)] px-2 py-1 text-[var(--text-xs)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-3)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              导出
            </button>
            {showExport && (
              <div className="absolute right-0 top-full mt-1 z-20 w-40 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-1)] py-1 shadow-xl">
                <a
                  href={`/api/projects/${currentProject.id}/export/txt`}
                  download
                  onClick={() => setShowExport(false)}
                  className="block px-3 py-1.5 text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-3)] hover:text-[var(--color-text-primary)]"
                >
                  导出 TXT
                </a>
                <a
                  href={`/api/projects/${currentProject.id}/export/md`}
                  download
                  onClick={() => setShowExport(false)}
                  className="block px-3 py-1.5 text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-3)] hover:text-[var(--color-text-primary)]"
                >
                  导出 Markdown
                </a>
                <a
                  href={`/api/projects/${currentProject.id}/export/epub`}
                  download
                  onClick={() => setShowExport(false)}
                  className="block px-3 py-1.5 text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-3)] hover:text-[var(--color-text-primary)]"
                >
                  导出 EPUB
                </a>
                <a
                  href={`/api/projects/${currentProject.id}/export/docx`}
                  download
                  onClick={() => setShowExport(false)}
                  className="block px-3 py-1.5 text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-3)] hover:text-[var(--color-text-primary)]"
                >
                  导出 DOCX
                </a>
              </div>
            )}
          </div>
        )}

        {/* Theme toggle */}
        <button
          onClick={cycleTheme}
          className="rounded-[var(--radius-sm)] px-2 py-1 text-[var(--text-xs)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-3)] hover:text-[var(--color-text-primary)] transition-colors"
          title={`主题：${theme === "dark" ? "暗色" : theme === "light" ? "亮色" : "阅读"}（点击切换）`}
        >
          {themeIcon}
        </button>

        <button
          onClick={toggleFullscreen}
          className="rounded-[var(--radius-sm)] p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-3)] hover:text-[var(--color-text-primary)] transition-colors duration-[var(--duration-fast)]"
          title={isFullscreen ? "退出全屏" : "全屏"}
        >
          {isFullscreen ? (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M2 10v4h4M14 6V2h-4M2 14l5-5M14 2L9 7" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M2 6V2h4M14 10v4h-4M2 2l5 5M14 14l-5-5" />
            </svg>
          )}
        </button>
      </div>
    </header>
  );
}
