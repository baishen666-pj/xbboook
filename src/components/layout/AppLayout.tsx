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

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Left panel */}
      {!isFullscreen && isLeftPanelOpen && (
        <ResizablePanel
          defaultWidth={leftPanelWidth}
          minWidth={200}
          maxWidth={500}
          side="left"
          onResize={setLeftPanelWidth}
        >
          <ChapterSidebar />
        </ResizablePanel>
      )}

      {/* Center area */}
      <div className="flex-1 overflow-hidden">
        {children}
      </div>

      {/* Right panel */}
      {!isFullscreen && isRightPanelOpen && rightPanel && (
        <ResizablePanel
          defaultWidth={rightPanelWidth}
          minWidth={260}
          maxWidth={600}
          side="right"
          onResize={setRightPanelWidth}
        >
          {rightPanel}
        </ResizablePanel>
      )}
    </div>
  );
}
