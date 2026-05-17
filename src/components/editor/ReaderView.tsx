import { useEffect, useRef, useState, useCallback } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { useUiStore } from "@/stores/uiStore";
import { useEditorStore } from "@/stores/editorStore";
import { useProjectStore } from "@/stores/projectStore";
import { chapterService } from "@/services/chapterService";
import { getEditorExtensions } from "./editorExtensions";

const projectStore = useProjectStore;
const editorStore = useEditorStore;

type ReaderTheme = "paper" | "dark" | "sepia";

function ReaderContent({ content, fontSize, width }: {
  content: string;
  fontSize: number;
  width: number;
}) {
  const editor = useEditor({
    extensions: getEditorExtensions(""),
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
      editor.commands.setContent(content, { emitUpdate: false });
    }
  }, [editor, content]);

  return (
    <div className="reader-scroll h-full overflow-y-auto px-4">
      <div
        style={{
          maxWidth: width,
          margin: "0 auto",
          fontSize: `${fontSize}px`,
          lineHeight: 1.9,
        }}
        className="reader-content py-12"
      >
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

export function ReaderView() {
  const exitReaderMode = useUiStore((s) => s.exitReaderMode);
  const activeChapterId = useEditorStore((s) => s.activeChapterId);
  const currentProject = useProjectStore((s) => s.currentProject);
  const chapters = useProjectStore((s) => s.chapters);

  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [fontSize, setFontSize] = useState(18);
  const [width, setWidth] = useState(680);
  const [readerTheme, setReaderTheme] = useState<ReaderTheme>("paper");
  const [showToc, setShowToc] = useState(false);

  const currentIndex = chapters.findIndex((ch) => ch.id === activeChapterId);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < chapters.length - 1;
  const currentChapter = chapters[currentIndex];

  useEffect(() => {
    if (!activeChapterId || !currentProject) return;
    let cancelled = false;
    setLoading(true);
    chapterService
      .getById(currentProject.id, activeChapterId)
      .then((res) => {
        if (!cancelled && res.success && res.data) {
          setContent(res.data.content ?? "");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [activeChapterId, currentProject]);

  const goToChapter = useCallback(
    (chapterId: string) => {
      const proj = projectStore.getState().currentProject;
      if (!proj) return;
      projectStore.getState().openChapter(chapterId).then((ch: any) => {
        if (ch) editorStore.getState().openChapter(ch.id, ch.content ?? "");
      });
    },
    [],
  );

  const themeBg = readerTheme === "paper"
    ? "bg-stone-50 text-stone-900"
    : readerTheme === "sepia"
      ? "bg-amber-50 text-amber-950"
      : "bg-zinc-900 text-zinc-200";

  const toolbarBg = readerTheme === "paper"
    ? "bg-white/90 border-stone-200"
    : readerTheme === "sepia"
      ? "bg-amber-100/90 border-amber-200"
      : "bg-zinc-800/90 border-zinc-700";

  const buttonClass = readerTheme === "dark"
    ? "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700"
    : "text-stone-500 hover:text-stone-800 hover:bg-stone-200";

  return (
    <div className={`relative h-full flex flex-col ${themeBg} transition-colors duration-300`}>
      {/* Progress bar */}
      <div className="h-0.5 w-full bg-black/5">
        <div
          className="h-full bg-indigo-500 transition-all duration-300"
          style={{
            width: chapters.length > 0
              ? `${((currentIndex + 1) / chapters.length) * 100}%`
              : "0%",
          }}
        />
      </div>

      {/* Main reading area */}
      <div className="flex-1 relative overflow-hidden">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <span className={`text-sm ${readerTheme === "dark" ? "text-zinc-500" : "text-stone-400"}`}>
              加载中...
            </span>
          </div>
        ) : content ? (
          <ReaderContent content={content} fontSize={fontSize} width={width} />
        ) : (
          <div className="flex h-full items-center justify-center">
            <span className={`text-sm ${readerTheme === "dark" ? "text-zinc-500" : "text-stone-400"}`}>
              请先打开一个章节
            </span>
          </div>
        )}

        {/* TOC sidebar */}
        {showToc && (
          <div className={`absolute left-0 top-0 bottom-0 w-64 border-r shadow-lg overflow-y-auto ${
            readerTheme === "paper"
              ? "bg-white border-stone-200"
              : readerTheme === "sepia"
                ? "bg-amber-50 border-amber-200"
                : "bg-zinc-800 border-zinc-700"
          }`}>
            <div className="p-3">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider opacity-50">
                  目录
                </span>
                <button
                  onClick={() => setShowToc(false)}
                  className={`p-1 rounded ${buttonClass}`}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
              {chapters.map((ch, i) => (
                <button
                  key={ch.id}
                  onClick={() => { goToChapter(ch.id); setShowToc(false); }}
                  className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors mb-0.5 ${
                    ch.id === activeChapterId
                      ? "bg-indigo-500/15 text-indigo-600 font-medium"
                      : buttonClass
                  }`}
                >
                  <span className="opacity-40 mr-1.5">{i + 1}.</span>
                  {ch.title}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bottom toolbar */}
      <div className={`flex items-center justify-between px-4 py-2 border-t backdrop-blur-sm ${toolbarBg}`}>
        {/* Left: navigation */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowToc((v) => !v)}
            className={`p-1.5 rounded transition-colors ${buttonClass}`}
            title="目录"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="15" y2="12" /><line x1="3" y1="18" x2="18" y2="18" />
            </svg>
          </button>
          <button
            onClick={() => hasPrev && goToChapter(chapters[currentIndex - 1]!.id)}
            disabled={!hasPrev}
            className={`p-1.5 rounded transition-colors ${hasPrev ? buttonClass : "opacity-20 cursor-not-allowed"}`}
            title="上一章"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <span className="text-[11px] opacity-40 tabular-nums min-w-[60px] text-center">
            {currentIndex + 1} / {chapters.length}
          </span>
          <button
            onClick={() => hasNext && goToChapter(chapters[currentIndex + 1]!.id)}
            disabled={!hasNext}
            className={`p-1.5 rounded transition-colors ${hasNext ? buttonClass : "opacity-20 cursor-not-allowed"}`}
            title="下一章"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>

        {/* Center: chapter title */}
        <div className="text-xs opacity-50 truncate max-w-[200px] text-center">
          {currentChapter?.title ?? ""}
        </div>

        {/* Right: controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setFontSize((s) => Math.max(14, s - 2))}
            className={`p-1.5 rounded transition-colors ${buttonClass}`}
            title="缩小字号"
          >
            <span className="text-xs font-bold">A-</span>
          </button>
          <span className="text-[10px] opacity-40 w-8 text-center tabular-nums">{fontSize}</span>
          <button
            onClick={() => setFontSize((s) => Math.min(28, s + 2))}
            className={`p-1.5 rounded transition-colors ${buttonClass}`}
            title="放大字号"
          >
            <span className="text-xs font-bold">A+</span>
          </button>

          <div className="w-px h-4 bg-current opacity-10 mx-1" />

          <button
            onClick={() => {
              const themes: ReaderTheme[] = ["paper", "sepia", "dark"];
              setReaderTheme((t) => {
                const next = themes[(themes.indexOf(t) + 1) % themes.length];
                return next ?? "paper";
              });
            }}
            className={`p-1.5 rounded transition-colors ${buttonClass}`}
            title="切换阅读主题"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
          </button>

          <button
            onClick={() => setWidth((w) => Math.max(480, w - 40))}
            className={`p-1.5 rounded transition-colors ${buttonClass}`}
            title="收窄"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="11 17 6 12 11 7" /><polyline points="6 12 18 12" />
            </svg>
          </button>
          <button
            onClick={() => setWidth((w) => Math.min(1000, w + 40))}
            className={`p-1.5 rounded transition-colors ${buttonClass}`}
            title="放宽"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="13 17 18 12 13 7" /><polyline points="18 12 6 12" />
            </svg>
          </button>

          <div className="w-px h-4 bg-current opacity-10 mx-1" />

          <button
            onClick={exitReaderMode}
            className={`p-1.5 rounded transition-colors ${buttonClass}`}
            title="退出阅读模式 (Esc)"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
