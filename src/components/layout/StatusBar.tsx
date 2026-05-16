import { useState, useMemo, lazy, Suspense } from "react";
import { useEditorStore } from "@/stores/editorStore";
import { useProjectStore } from "@/stores/projectStore";
import { countMixedText } from "@/lib/word-count";
import { CollabStatusBar } from "@/components/collab/CollabStatusBar";

const StatsPanel = lazy(() => import("@/components/stats/StatsPanel").then(m => ({ default: m.StatsPanel })));
const DashboardPanel = lazy(() => import("@/components/dashboard/DashboardPanel").then(m => ({ default: m.DashboardPanel })));

export function StatusBar() {
  const content = useEditorStore((s) => s.content);
  const activeChapterId = useEditorStore((s) => s.activeChapterId);
  const chapters = useProjectStore((s) => s.chapters);
  const [showStats, setShowStats] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);

  const stats = useMemo(() => countMixedText(content), [content]);
  const activeChapter = useMemo(
    () => chapters.find((c) => c.id === activeChapterId),
    [chapters, activeChapterId],
  );

  return (
    <footer className="relative flex h-7 items-center justify-between border-t border-[var(--color-border)] bg-[var(--color-surface-1)] px-4 text-[var(--text-xs)] text-[var(--color-text-muted)]" role="contentinfo" aria-label="状态栏">
      <div className="flex items-center gap-4">
        {activeChapter && (
          <span className="truncate max-w-48" title={activeChapter.title}>
            {activeChapter.title}
          </span>
        )}
        {activeChapterId && (
          <>
            <span>{stats.words} 字</span>
            <span>{stats.characters} 字符</span>
            <span>{stats.paragraphs} 段</span>
          </>
        )}
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={() => { setShowDashboard(false); setShowStats(!showStats); }}
          className="flex items-center gap-1 hover:text-[var(--color-text-primary)] transition-colors btn-hover-scale min-h-[28px] px-1"
          aria-label="写作统计"
          aria-expanded={showStats}
        >
          统计
        </button>
        <button
          onClick={() => { setShowStats(false); setShowDashboard(!showDashboard); }}
          className="flex items-center gap-1 hover:text-[var(--color-text-primary)] transition-colors btn-hover-scale min-h-[28px] px-1"
          aria-label="仪表盘"
          aria-expanded={showDashboard}
        >
          仪表盘
        </button>
        <CollabStatusBar />
        <span className="flex items-center gap-1">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--color-success)]" aria-hidden="true" />
          AI 就绪
        </span>
      </div>

      {/* Stats popover */}
      {showStats && (
        <div className="absolute bottom-7 right-4 z-30 w-72 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] shadow-[var(--shadow-lg)] animate-[slideUp_200ms_var(--ease-out)]" role="dialog" aria-modal="true" aria-label="写作统计">
          <div className="flex items-center justify-between border-b border-[var(--color-border-subtle)] px-3 py-2">
            <span className="text-[var(--text-xs)] font-medium text-[var(--color-text-secondary)]">写作统计</span>
            <button onClick={() => setShowStats(false)} className="text-[var(--text-xs)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]" aria-label="关闭统计面板">&times;</button>
          </div>
          <Suspense fallback={<div className="p-4 text-[var(--color-text-muted)] text-[var(--text-sm)]">加载中...</div>}>
            <StatsPanel />
          </Suspense>
        </div>
      )}

      {/* Dashboard popover */}
      {showDashboard && (
        <div className="absolute bottom-7 right-0 z-30 w-[640px] h-[480px] rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] shadow-[var(--shadow-lg)] animate-[slideUp_200ms_var(--ease-out)]" role="dialog" aria-modal="true" aria-label="仪表盘">
          <Suspense fallback={<div className="p-4 text-[var(--color-text-muted)] text-[var(--text-sm)]">加载中...</div>}>
            <DashboardPanel onClose={() => setShowDashboard(false)} />
          </Suspense>
        </div>
      )}
    </footer>
  );
}