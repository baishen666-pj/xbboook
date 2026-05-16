import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import CharacterCount from "@tiptap/extension-character-count";
import Highlight from "@tiptap/extension-highlight";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import { Markdown } from "tiptap-markdown";
import { useUiStore } from "@/stores/uiStore";
import { useProjectStore } from "@/stores/projectStore";
import { useEditorStore } from "@/stores/editorStore";
import { chapterService } from "@/services/chapterService";
import { GhostMark } from "./GhostMark";
import "@/styles/editor.css";

function ReadOnlyEditor({ content }: { content: string }) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Placeholder.configure({ placeholder: "" }),
      CharacterCount,
      Highlight.configure({ multicolor: false }),
      Underline,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Markdown.configure({
        transformPastedText: true,
        transformCopiedText: true,
      }),
      GhostMark,
    ],
    content,
    editable: false,
    editorProps: {
      attributes: {
        class: "tiptap ProseMirror",
      },
    },
    immediatelyRender: false,
  });

  const prevContentRef = useRef(content);
  useEffect(() => {
    if (editor && content !== prevContentRef.current) {
      prevContentRef.current = content;
      editor.commands.setContent(content, false);
    }
  }, [editor, content]);

  return (
    <div className="h-full overflow-y-auto">
      <EditorContent editor={editor} className="h-full" />
    </div>
  );
}

interface SplitPaneProps {
  children: ReactNode;
}

export function SplitPane({ children }: SplitPaneProps) {
  const splitRatio = useUiStore((s) => s.splitRatio);
  const setSplitRatio = useUiStore((s) => s.setSplitRatio);
  const splitChapterId = useUiStore((s) => s.splitChapterId);
  const setSplitChapterId = useUiStore((s) => s.setSplitChapterId);
  const toggleSplitPane = useUiStore((s) => s.toggleSplitPane);

  const chapters = useProjectStore((s) => s.chapters);
  const currentProject = useProjectStore((s) => s.currentProject);
  const activeChapterId = useEditorStore((s) => s.activeChapterId);

  const [splitContent, setSplitContent] = useState("");
  const [isLoadingSplit, setIsLoadingSplit] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const startRatio = useRef(0);

  const availableChapters = chapters.filter(
    (ch) => ch.id !== activeChapterId
  );

  const selectedChapter = chapters.find((ch) => ch.id === splitChapterId);

  useEffect(() => {
    if (!splitChapterId || !currentProject) {
      setSplitContent("");
      return;
    }
    let cancelled = false;
    setIsLoadingSplit(true);
    chapterService
      .getById(currentProject.id, splitChapterId)
      .then((res) => {
        if (!cancelled && res.success && res.data) {
          setSplitContent(res.data.content ?? "");
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingSplit(false);
      });
    return () => {
      cancelled = true;
    };
  }, [splitChapterId, currentProject]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isDragging.current = true;
      startX.current = e.clientX;
      startRatio.current = splitRatio;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!isDragging.current || !containerRef.current) return;
        const containerWidth = containerRef.current.offsetWidth;
        const delta = moveEvent.clientX - startX.current;
        const ratioDelta = delta / containerWidth;
        const nextRatio = startRatio.current + ratioDelta;
        setSplitRatio(nextRatio);
      };

      const handleMouseUp = () => {
        isDragging.current = false;
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [splitRatio, setSplitRatio]
  );

  const leftWidth = `${splitRatio * 100}%`;
  const rightWidth = `${(1 - splitRatio) * 100}%`;

  return (
    <div ref={containerRef} className="flex h-full w-full">
      {/* Left: main editor */}
      <div className="flex flex-col overflow-hidden" style={{ width: leftWidth }}>
        {children}
      </div>

      {/* Divider */}
      <div
        className="group relative flex-shrink-0 cursor-col-resize"
        onMouseDown={handleMouseDown}
      >
        <div className="absolute inset-y-0 -left-1 -right-1 z-10" />
        <div className="h-full w-px bg-[var(--color-border)] group-hover:bg-[var(--color-primary)] transition-colors duration-[var(--duration-fast)]" />
      </div>

      {/* Right: read-only reference editor */}
      <div className="flex flex-col overflow-hidden" style={{ width: rightWidth }}>
        {/* Right panel header */}
        <div className="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface-1)] px-3 py-1.5">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--color-text-muted)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="flex-shrink-0"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <line x1="12" y1="3" x2="12" y2="21" />
            </svg>
            <select
              value={splitChapterId ?? ""}
              onChange={(e) => setSplitChapterId(e.target.value || null)}
              className="min-w-0 flex-1 rounded border border-[var(--color-border)] bg-[var(--color-surface-0)] px-2 py-0.5 text-[var(--text-xs)] text-[var(--color-text-secondary)] outline-none focus:border-[var(--color-primary)]"
            >
              <option value="">选择参考章节</option>
              {availableChapters.map((ch) => (
                <option key={ch.id} value={ch.id}>
                  {ch.title}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={toggleSplitPane}
            className="ml-2 flex-shrink-0 rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-secondary)] transition-colors"
            title="关闭分屏"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Right editor content */}
        <div className="flex-1 overflow-hidden bg-[var(--color-surface-0)]">
          {isLoadingSplit && (
            <div className="flex h-full items-center justify-center">
              <span className="text-[var(--text-xs)] text-[var(--color-text-muted)]">
                加载中...
              </span>
            </div>
          )}
          {!isLoadingSplit && !splitChapterId && (
            <div className="flex h-full items-center justify-center">
              <div className="flex flex-col items-center gap-2 text-center">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--color-text-muted)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                  <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                </svg>
                <p className="text-[var(--text-xs)] text-[var(--color-text-muted)]">
                  选择章节以参考阅读
                </p>
              </div>
            </div>
          )}
          {!isLoadingSplit && splitChapterId && splitContent && (
            <ReadOnlyEditor content={splitContent} />
          )}
          {!isLoadingSplit && splitChapterId && !splitContent && selectedChapter && (
            <div className="flex h-full items-center justify-center">
              <p className="text-[var(--text-xs)] text-[var(--color-text-muted)]">
                该章节暂无内容
              </p>
            </div>
          )}
        </div>

        {/* Right panel footer */}
        {splitChapterId && selectedChapter && (
          <div className="flex items-center border-t border-[var(--color-border)] bg-[var(--color-surface-1)] px-3 py-1 text-[var(--text-xs)] text-[var(--color-text-muted)]">
            <span>只读模式</span>
            <span className="mx-2 text-[var(--color-border)]">|</span>
            <span>{selectedChapter.title}</span>
            <span className="mx-2 text-[var(--color-border)]">|</span>
            <span>{selectedChapter.wordCount.toLocaleString()} 字</span>
          </div>
        )}
      </div>
    </div>
  );
}
