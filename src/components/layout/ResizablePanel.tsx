import { type ReactNode, useCallback, useRef, useState } from "react";

interface ResizablePanelProps {
  defaultWidth: number;
  minWidth: number;
  maxWidth: number;
  onResize?: (width: number) => void;
  children: ReactNode;
  side: "left" | "right";
}

export function ResizablePanel({
  defaultWidth,
  minWidth,
  maxWidth,
  onResize,
  children,
  side,
}: ResizablePanelProps) {
  const [width, setWidth] = useState(defaultWidth);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);
  const latestWidth = useRef(defaultWidth);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isDragging.current = true;
      startX.current = e.clientX;
      startWidth.current = latestWidth.current;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!isDragging.current) return;
        const delta =
          side === "left"
            ? moveEvent.clientX - startX.current
            : startX.current - moveEvent.clientX;
        const nextWidth = Math.min(
          maxWidth,
          Math.max(minWidth, startWidth.current + delta)
        );
        latestWidth.current = nextWidth;
        setWidth(nextWidth);
      };

      const handleMouseUp = () => {
        isDragging.current = false;
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        onResize?.(latestWidth.current);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [minWidth, maxWidth, side, onResize]
  );

  return (
    <div
      className="relative flex-shrink-0 overflow-hidden"
      style={{ width }}
    >
      {children}
      {/* Drag handle */}
      <div
        className="absolute top-0 bottom-0 z-10 w-1 cursor-col-resize hover:bg-[var(--color-primary)]/30 transition-colors duration-[var(--duration-fast)]"
        style={{ [side === "left" ? "right" : "left"]: 0 }}
        onMouseDown={handleMouseDown}
        role="separator"
        aria-orientation="vertical"
        aria-valuenow={width}
        aria-valuemin={minWidth}
        aria-valuemax={maxWidth}
        aria-label="调整面板宽度"
        tabIndex={0}
      />
    </div>
  );
}
