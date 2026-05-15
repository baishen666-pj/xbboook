import { useMemo } from "react";
import { countMixedText } from "@/lib/word-count";
import { useEditorStore } from "@/stores/editorStore";
import { useProjectStore } from "@/stores/projectStore";

export function WordCounter() {
  const content = useEditorStore((s) => s.content);
  const activeChapterId = useEditorStore((s) => s.activeChapterId);
  const chapters = useProjectStore((s) => s.chapters);

  const currentStats = useMemo(() => countMixedText(content), [content]);
  const totalWords = useMemo(() => chapters.reduce((sum, ch) => sum + ch.wordCount, 0), [chapters]);

  if (!activeChapterId) return null;

  return (
    <div className="flex items-center gap-4 border-t border-[var(--color-border)] bg-[var(--color-surface-1)] px-4 py-1 text-[var(--text-xs)] text-[var(--color-text-muted)]">
      <span>
        总计：<strong className="text-[var(--color-text-secondary)]">{totalWords.toLocaleString()}</strong> 字
      </span>
      <span className="text-[var(--color-border)]">|</span>
      <span>
        本章：<strong className="text-[var(--color-text-secondary)]">{currentStats.words.toLocaleString()}</strong> 字
      </span>
      <span className="text-[var(--color-border)]">|</span>
      <span>
        <strong className="text-[var(--color-text-secondary)]">{currentStats.paragraphs}</strong> 段
      </span>
    </div>
  );
}
