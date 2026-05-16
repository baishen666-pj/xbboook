import { useEditorStore } from "@/stores/editorStore";
import { useUiStore } from "@/stores/uiStore";
import { useAutoSave } from "@/hooks/useAutoSave";
import { NovelEditor } from "./NovelEditor";
import { WordCounter } from "./WordCounter";
import { GhostTextToolbar } from "./GhostTextToolbar";
import { SaveIndicator } from "./SaveIndicator";
import { WritingTimer } from "./WritingTimer";
import { SplitPane } from "./SplitPane";

export function EditorArea() {
  const activeChapterId = useEditorStore((s) => s.activeChapterId);
  const content = useEditorStore((s) => s.content);
  const isSaving = useEditorStore((s) => s.isSaving);
  const isDirty = useEditorStore((s) => s.isDirty);
  const splitPane = useUiStore((s) => s.splitPane);
  const toggleSplitPane = useUiStore((s) => s.toggleSplitPane);

  useAutoSave();

  if (!activeChapterId) {
    return (
      <div className="flex h-full items-center justify-center bg-[var(--color-surface-0)]" id="main-content">
        <div className="flex flex-col items-center gap-4 text-center px-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--color-primary-subtle)]">
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--color-primary)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 20h9M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
          </div>
          <div>
            <p className="text-[var(--color-text-secondary)] font-medium">
              选择章节开始写作
            </p>
            <p className="mt-1 text-[var(--text-xs)] text-[var(--color-text-muted)]">
              从左侧章节列表中选择一个章节，或创建新章节
            </p>
          </div>
          <div className="flex items-center gap-1 text-[var(--text-xs)] text-[var(--color-text-muted)]">
            <kbd className="rounded border border-[var(--color-border)] px-1.5 py-0.5 font-mono text-[10px]">Ctrl</kbd>
            <span aria-hidden="true">+</span>
            <kbd className="rounded border border-[var(--color-border)] px-1.5 py-0.5 font-mono text-[10px]">N</kbd>
            <span className="ml-1">新建章节</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-[var(--color-surface-0)]" id="main-content">
      {/* Unsaved banner */}
      {isDirty && !isSaving && (
        <div className="flex items-center justify-between border-b border-[var(--color-warning)]/20 bg-[var(--color-warning)]/5 px-4 py-1">
          <SaveIndicator />
          <span className="text-[var(--text-xs)] text-[var(--color-text-muted)]">
            Ctrl+S 立即保存
          </span>
        </div>
      )}

      {/* Saving toast */}
      {isSaving && (
        <div className="absolute top-12 right-4 z-10 flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--color-surface-2)] px-2.5 py-1 text-[var(--text-xs)] text-[var(--color-text-muted)] shadow-[var(--shadow-sm)]">
          <span className="inline-block h-2 w-2 rounded-full bg-[var(--color-primary)] animate-[pulse-subtle_1.5s_ease-in-out_infinite]" />
          保存中...
        </div>
      )}

      {/* Editor area */}
      {splitPane ? (
        <SplitPane>
          <div className="flex-1 overflow-hidden relative">
            <NovelEditor content={content} />
            <GhostTextToolbar />
          </div>
        </SplitPane>
      ) : (
        <div className="flex-1 overflow-hidden relative">
          <NovelEditor content={content} />
          <GhostTextToolbar />
        </div>
      )}

      {/* Bottom bar: word count + writing timer + split toggle */}
      <div className="flex items-center justify-between border-t border-[var(--color-border)] bg-[var(--color-surface-1)] px-4 py-1">
        <WordCounter />
        <div className="flex items-center gap-2">
          <WritingTimer />
          <span className="text-[var(--color-border)]">|</span>
          <button
            onClick={toggleSplitPane}
            className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[var(--text-xs)] transition-colors ${
              splitPane
                ? "text-[var(--color-primary)] bg-[var(--color-primary-subtle)]"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)]"
            }`}
            title={splitPane ? "关闭分屏" : "分屏参考"}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <line x1="12" y1="3" x2="12" y2="21" />
            </svg>
            {splitPane ? "分屏中" : "分屏"}
          </button>
        </div>
      </div>
    </div>
  );
}
