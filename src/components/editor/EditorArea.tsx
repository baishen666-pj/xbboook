import { useEditorStore } from "@/stores/editorStore";
import { useAutoSave } from "@/hooks/useAutoSave";
import { NovelEditor } from "./NovelEditor";
import { WordCounter } from "./WordCounter";

export function EditorArea() {
  const activeChapterId = useEditorStore((s) => s.activeChapterId);
  const content = useEditorStore((s) => s.content);

  // Enable auto-save hook
  useAutoSave();

  if (!activeChapterId) {
    return (
      <div className="flex h-full items-center justify-center bg-[var(--color-surface-0)]">
        <div className="flex flex-col items-center gap-3 text-center">
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--color-text-muted)"
            strokeWidth="1"
          >
            <path d="M12 20h9M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
          <p className="text-[var(--color-text-muted)]">
            Select a chapter from the sidebar to start writing
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-[var(--color-surface-0)]">
      {/* Toolbar area — placeholder; real toolbar uses editor ref */}
      <div className="flex-shrink-0">
        <div className="flex items-center gap-0.5 border-b border-[var(--color-border)] bg-[var(--color-surface-1)] px-2 py-1">
          <span className="px-2 py-1 text-[var(--text-xs)] text-[var(--color-text-muted)]">
            B
          </span>
          <span className="px-2 py-1 text-[var(--text-xs)] text-[var(--color-text-muted)]">
            I
          </span>
          <span className="px-2 py-1 text-[var(--text-xs)] text-[var(--color-text-muted)]">
            H1
          </span>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-hidden">
        <NovelEditor content={content} />
      </div>

      {/* Word counter */}
      <WordCounter />
    </div>
  );
}
