import { countMixedText } from "@/lib/word-count";
import { useEditorStore } from "@/stores/editorStore";
import { useProjectStore } from "@/stores/projectStore";

export function WordCounter() {
  const content = useEditorStore((s) => s.content);
  const activeChapterId = useEditorStore((s) => s.activeChapterId);
  const chapters = useProjectStore((s) => s.chapters);

  const currentStats = countMixedText(content);

  // Calculate total word count across all chapters
  const totalWords = chapters.reduce((sum, ch) => sum + ch.wordCount, 0);

  if (!activeChapterId) return null;

  return (
    <div className="flex items-center gap-4 border-t border-[var(--color-border)] bg-[var(--color-surface-1)] px-4 py-1 text-[var(--text-xs)] text-[var(--color-text-muted)]">
      <span>
        Total: <strong className="text-[var(--color-text-secondary)]">{totalWords.toLocaleString()}</strong>
      </span>
      <span className="text-[var(--color-border)]">|</span>
      <span>
        Chapter: <strong className="text-[var(--color-text-secondary)]">{currentStats.words.toLocaleString()}</strong>
      </span>
      <span className="text-[var(--color-border)]">|</span>
      <span>
        Paragraphs: <strong className="text-[var(--color-text-secondary)]">{currentStats.paragraphs}</strong>
      </span>
    </div>
  );
}
