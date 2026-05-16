import { type ReactNode } from "react";
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
  const leftPanelWidth = useUiStore((s) => s.leftPanelWidth);
  const rightPanelWidth = useUiStore((s) => s.rightPanelWidth);
  const setLeftPanelWidth = useUiStore((s) => s.setLeftPanelWidth);
  const setRightPanelWidth = useUiStore((s) => s.setRightPanelWidth);
  const activeLeftTab = useUiStore((s) => s.activeLeftTab);

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Left panel — desktop: resizable, mobile: overlay */}
      {!isFullscreen && isLeftPanelOpen && (
        <>
          {/* Desktop resizable panel */}
          <div className="hidden md:block">
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
          <div className="md:hidden fixed inset-0 z-40">
            <div className="absolute inset-0 bg-black/50 animate-[fadeIn_150ms_var(--ease-out)]" onClick={() => useUiStore.getState().toggleLeftPanel()} />
            <div className="absolute left-0 top-0 bottom-0 w-72 bg-[var(--color-surface-1)] shadow-lg animate-[slideInLeft_200ms_var(--ease-out)]">
              <ChapterSidebar />
            </div>
          </div>
        </>
      )}

      {/* Center area */}
      <div className="flex-1 overflow-hidden min-w-0">
        {children}
      </div>

      {/* Right panel — desktop: resizable, mobile: overlay */}
      {!isFullscreen && isRightPanelOpen && rightPanel && (
        <>
          <div className="hidden md:block">
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
          <div className="md:hidden fixed inset-0 z-40">
            <div className="absolute inset-0 bg-black/50 animate-[fadeIn_150ms_var(--ease-out)]" onClick={() => useUiStore.getState().toggleRightPanel()} />
            <div className="absolute right-0 top-0 bottom-0 w-80 bg-[var(--color-surface-1)] shadow-lg animate-[slideInRight_200ms_var(--ease-out)]">
              {rightPanel}
            </div>
          </div>
        </>
      )}

      {/* Mobile bottom navigation */}
      {!isFullscreen && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-30 flex h-12 border-t border-[var(--color-border)] bg-[var(--color-surface-1)]">
          <button
            onClick={() => {
              const s = useUiStore.getState();
              if (s.isLeftPanelOpen) s.toggleLeftPanel();
              else { s.setActiveLeftTab("chapters"); s.toggleLeftPanel(); }
            }}
            className={`flex-1 flex flex-col items-center justify-center text-[10px] ${activeLeftTab === "chapters" ? "text-[var(--color-primary)]" : "text-[var(--color-text-muted)]"}`}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 3h14M2 9h14M2 15h14" /></svg>
            章节
          </button>
          <button
            onClick={() => {
              const s = useUiStore.getState();
              if (s.isLeftPanelOpen) s.toggleLeftPanel();
              else { s.setActiveLeftTab("characters"); s.toggleLeftPanel(); }
            }}
            className={`flex-1 flex flex-col items-center justify-center text-[10px] ${activeLeftTab === "characters" ? "text-[var(--color-primary)]" : "text-[var(--color-text-muted)]"}`}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="9" cy="6" r="3" /><path d="M3 16c0-3 3-5 6-5s6 2 6 5" /></svg>
            角色
          </button>
          <button
            onClick={() => {
              const s = useUiStore.getState();
              if (s.isLeftPanelOpen) s.toggleLeftPanel();
              else { s.setActiveLeftTab("outline"); s.toggleLeftPanel(); }
            }}
            className={`flex-1 flex flex-col items-center justify-center text-[10px] ${activeLeftTab === "outline" ? "text-[var(--color-primary)]" : "text-[var(--color-text-muted)]"}`}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 3h12M3 7h12M3 11h8M3 15h8" /></svg>
            大纲
          </button>
          <button
            onClick={() => useUiStore.getState().toggleRightPanel()}
            className="flex-1 flex flex-col items-center justify-center text-[10px] text-[var(--color-text-muted)]"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2l2 2-7 7H7v-2l7-7z" /></svg>
            AI
          </button>
        </div>
      )}
    </div>
  );
}
