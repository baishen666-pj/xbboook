import { useState } from "react";
import { useEditorStore } from "@/stores/editorStore";
import { useProjectStore } from "@/stores/projectStore";
import { countMixedText } from "@/lib/word-count";
import { StatsPanel } from "@/components/stats/StatsPanel";

export function StatusBar() {
  const content = useEditorStore((s) => s.content);
  const activeChapterId = useEditorStore((s) => s.activeChapterId);
  const chapters = useProjectStore((s) => s.chapters);
  const [showStats, setShowStats] = useState(false);

  const stats = countMixedText(content);
  const activeChapter = chapters.find((c) => c.id === activeChapterId);

  return (
    <footer className="relative flex h-7 items-center justify-between border-t border-[var(--color-border)] bg-[var(--color-surface-1)] px-4 text-[var(--text-xs)] text-[var(--color-text-muted)]">
      <div className="flex items-center gap-4">
        {activeChapter && (
          <span>
            {activeChapter.title}
          </span>
        )}
        {activeChapterId && (
          <>
            <span>{stats.words} words</span>
            <span>{stats.characters} chars</span>
            <span>{stats.paragraphs} paragraphs</span>
          </>
        )}
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={() => setShowStats(!showStats)}
          className="flex items-center gap-1 hover:text-[var(--color-text-primary)] transition-colors"
        >
          统计
        </button>
        <span className="flex items-center gap-1">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--color-success)]" />
          AI Ready
        </span>
      </div>

      {/* Stats popover */}
      {showStats && (
        <div className="absolute bottom-7 right-4 z-30 w-72 rounded-xl border border-white/10 bg-[oklch(0.16_0_0)] shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/5 px-3 py-2">
            <span className="text-xs font-medium text-white/60">写作统计</span>
            <button onClick={() => setShowStats(false)} className="text-xs text-white/30 hover:text-white/60">×</button>
          </div>
          <StatsPanel />
        </div>
      )}
    </footer>
  );
}
