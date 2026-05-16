import { type ReactNode, useEffect, useRef } from "react";
import { useUiStore } from "@/stores/uiStore";
import { ChapterSidebar } from "@/components/sidebar/ChapterSidebar";
import { ResizablePanel } from "./ResizablePanel";

interface AppLayoutProps {
  children: ReactNode;
  rightPanel?: ReactNode;
}

export function AppLayout({ children, rightPanel }: AppLayoutProps) {
  const isLeftPanelOpen = useUiStore((s) => s.isLeftPanelOpen);
  const isRightPanelOpen = useUiStore((s) => s.isRightPanelOpen);
  const isFullscreen = useUiStore((s) => s.isFullscreen);
  const isFocusMode = useUiStore((s) => s.isFocusMode);
  const leftPanelWidth = useUiStore((s) => s.leftPanelWidth);
  const rightPanelWidth = useUiStore((s) => s.rightPanelWidth);
  const setLeftPanelWidth = useUiStore((s) => s.setLeftPanelWidth);
  const setRightPanelWidth = useUiStore((s) => s.setRightPanelWidth);
  const activeLeftTab = useUiStore((s) => s.activeLeftTab);

  // Swipe gestures for mobile
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const onStart = (e: TouchEvent) => {
      const t = e.touches.item(0);
      if (!t) return;
      touchStartRef.current = { x: t.clientX, y: t.clientY };
    };
    const onEnd = (e: TouchEvent) => {
      const start = touchStartRef.current;
      if (!start) return;
      const t = e.changedTouches.item(0);
      if (!t) return;
      const dx = t.clientX - start.x;
      const dy = Math.abs(t.clientY - start.y);
      const sx = start.x;
      touchStartRef.current = null;
      if (dy > Math.abs(dx) || Math.abs(dx) < 60) return;
      const sw = window.innerWidth;
      const s = useUiStore.getState();
      if (dx > 0 && sx < 20 && !s.isLeftPanelOpen) s.toggleLeftPanel();
      else if (dx < 0 && s.isLeftPanelOpen) s.toggleLeftPanel();
      if (dx < 0 && sx > sw - 20 && !s.isRightPanelOpen) s.toggleRightPanel();
      else if (dx > 0 && s.isRightPanelOpen) s.toggleRightPanel();
    };
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });
    return () => { window.removeEventListener("touchstart", onStart); window.removeEventListener("touchend", onEnd); };
  }, [isLeftPanelOpen, isRightPanelOpen, rightPanel]);

  // ESC to exit focus mode
  useEffect(() => {
    if (!isFocusMode) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        useUiStore.getState().exitFocusMode();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isFocusMode]);

  // Focus mode: editor only, centered
  if (isFocusMode) {
    return (
      <div className="flex flex-1 overflow-hidden bg-[var(--color-surface-0)]" role="main" aria-label="专注模式编辑器">
        <div className="flex-1 overflow-hidden smooth-scroll">
          <div className="mx-auto h-full" style={{ maxWidth: 720 }}>
            {children}
          </div>
        </div>
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-full bg-[var(--color-surface-2)]/80 px-3 py-1.5 text-[var(--text-xs)] text-[var(--color-text-muted)] shadow-[var(--shadow-lg)] backdrop-blur-sm" role="status">
          <span>专注模式</span>
          <span className="text-[var(--color-text-muted)]" aria-hidden="true">·</span>
          <span>ESC 退出</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Left panel — desktop: resizable, mobile: overlay */}
      {!isFullscreen && isLeftPanelOpen && (
        <>
          {/* Desktop resizable panel */}
          <div className="hidden md:block sidebar-panel-enter">
            <ResizablePanel
              defaultWidth={leftPanelWidth}
              minWidth={200}
              maxWidth={500}
              side="left"
              onResize={setLeftPanelWidth}
            >
              <ChapterSidebar />
            </ResizablePanel>
          </div>
          {/* Mobile overlay */}
          <div className="md:hidden fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label="侧边栏">
            <div
              className="absolute inset-0 bg-black/50 modal-backdrop-enter"
              onClick={() => useUiStore.getState().toggleLeftPanel()}
              aria-hidden="true"
            />
            <nav
              className="absolute left-0 top-0 bottom-0 w-72 bg-[var(--color-surface-1)] shadow-lg animate-[slideInLeft_200ms_var(--ease-out)]"
              aria-label="章节导航"
            >
              <ChapterSidebar />
            </nav>
          </div>
        </>
      )}

      {/* Center area */}
      <div className="flex-1 overflow-hidden min-w-0 smooth-scroll" role="main">
        {children}
      </div>

      {/* Right panel — desktop: resizable, mobile: overlay */}
      {!isFullscreen && isRightPanelOpen && rightPanel && (
        <>
          <div className="hidden md:block sidebar-panel-enter">
            <ResizablePanel
              defaultWidth={rightPanelWidth}
              minWidth={260}
              maxWidth={600}
              side="right"
              onResize={setRightPanelWidth}
            >
              {rightPanel}
            </ResizablePanel>
          </div>
          <div className="md:hidden fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label="AI 面板">
            <div
              className="absolute inset-0 bg-black/50 modal-backdrop-enter"
              onClick={() => useUiStore.getState().toggleRightPanel()}
              aria-hidden="true"
            />
            <aside
              className="absolute right-0 top-0 bottom-0 w-80 bg-[var(--color-surface-1)] shadow-lg animate-[slideInRight_200ms_var(--ease-out)]"
              aria-label="AI 助手"
            >
              {rightPanel}
            </aside>
          </div>
        </>
      )}

      {/* Mobile bottom navigation */}
      {!isFullscreen && (
        <nav
          className="md:hidden fixed bottom-0 left-0 right-0 z-30 flex h-14 border-t border-[var(--color-border)] bg-[var(--color-surface-1)] mobile-nav"
          aria-label="主导航"
        >
          <button
            onClick={() => {
              const s = useUiStore.getState();
              if (s.isLeftPanelOpen) s.toggleLeftPanel();
              else { s.setActiveLeftTab("chapters"); s.toggleLeftPanel(); }
            }}
            className={`touch-target flex-1 flex flex-col items-center justify-center text-[10px] ${activeLeftTab === "chapters" ? "text-[var(--color-primary)]" : "text-[var(--color-text-muted)]"}`}
            aria-label="章节列表"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M2 3h14M2 9h14M2 15h14" /></svg>
            章节
          </button>
          <button
            onClick={() => {
              const s = useUiStore.getState();
              if (s.isLeftPanelOpen) s.toggleLeftPanel();
              else { s.setActiveLeftTab("characters"); s.toggleLeftPanel(); }
            }}
            className={`touch-target flex-1 flex flex-col items-center justify-center text-[10px] ${activeLeftTab === "characters" ? "text-[var(--color-primary)]" : "text-[var(--color-text-muted)]"}`}
            aria-label="角色列表"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><circle cx="9" cy="6" r="3" /><path d="M3 16c0-3 3-5 6-5s6 2 6 5" /></svg>
            角色
          </button>
          <button
            onClick={() => {
              const s = useUiStore.getState();
              if (s.isLeftPanelOpen) s.toggleLeftPanel();
              else { s.setActiveLeftTab("outline"); s.toggleLeftPanel(); }
            }}
            className={`touch-target flex-1 flex flex-col items-center justify-center text-[10px] ${activeLeftTab === "outline" ? "text-[var(--color-primary)]" : "text-[var(--color-text-muted)]"}`}
            aria-label="大纲"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M3 3h12M3 7h12M3 11h8M3 15h8" /></svg>
            大纲
          </button>
          <button
            onClick={() => {
              const s = useUiStore.getState();
              if (s.isLeftPanelOpen) s.toggleLeftPanel();
              else { s.setActiveLeftTab("foreshadowing"); s.toggleLeftPanel(); }
            }}
            className={`touch-target flex-1 flex flex-col items-center justify-center text-[10px] ${activeLeftTab === "foreshadowing" ? "text-[var(--color-primary)]" : "text-[var(--color-text-muted)]"}`}
            aria-label="伏笔管理"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M3 3l6 6M9 9l6 6M3 15l6-6M9 9l6-6" /></svg>
            伏笔
          </button>
          <button
            onClick={() => useUiStore.getState().toggleRightPanel()}
            className="touch-target flex-1 flex flex-col items-center justify-center text-[10px] text-[var(--color-text-muted)]"
            aria-label="AI 助手"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M14 2l2 2-7 7H7v-2l7-7z" /></svg>
            AI
          </button>
        </nav>
      )}
    </div>
  );
}
