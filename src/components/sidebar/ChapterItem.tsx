import { useRef, useState } from "react";
import type { Chapter } from "@/types/project";

interface ChapterItemProps {
  chapter: Chapter;
  isActive: boolean;
  onClick: () => void;
  onReorder?: (dragId: string, dropId: string, position: "before" | "after") => void;
}

const STATUS_DOT: Record<string, string> = {
  draft: "bg-[var(--color-text-muted)]",
  writing: "bg-[var(--color-warning)]",
  revised: "bg-[var(--color-primary)]",
  done: "bg-[var(--color-success)]",
};

export function ChapterItem({ chapter, isActive, onClick, onReorder }: ChapterItemProps) {
  const [dragOver, setDragOver] = useState<"before" | "after" | null>(null);
  const dragRef = useRef<HTMLDivElement>(null);

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("text/plain", chapter.id);
    e.dataTransfer.effectAllowed = "move";
    dragRef.current?.classList.add("opacity-40");
  };

  const handleDragEnd = () => {
    dragRef.current?.classList.remove("opacity-40");
    setDragOver(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    setDragOver(e.clientY < midY ? "before" : "after");
  };

  const handleDragLeave = () => {
    setDragOver(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(null);
    const dragId = e.dataTransfer.getData("text/plain");
    if (dragId && dragId !== chapter.id && onReorder) {
      const rect = (e.target as HTMLElement).getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      const position = e.clientY < midY ? "before" : "after";
      onReorder(dragId, chapter.id, position);
    }
  };

  return (
    <div
      ref={dragRef}
      draggable={!!onReorder}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="relative"
    >
      {dragOver === "before" && (
        <div className="absolute left-2 right-2 top-0 h-0.5 bg-[var(--color-primary)] rounded-full" />
      )}
      <button
        onClick={onClick}
        className={[
          "group flex w-full items-center gap-2 rounded-[var(--radius-sm)] px-3 py-1.5 text-left transition-colors",
          isActive
            ? "bg-[var(--color-primary-subtle)] text-[var(--color-primary)]"
            : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-primary)]",
          onReorder ? "cursor-pointer" : "",
        ].join(" ")}
      >
        <span
          className={[
            "inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full",
            STATUS_DOT[chapter.status] ?? STATUS_DOT.draft,
          ].join(" ")}
        />
        <span className="flex-1 truncate text-[var(--text-sm)]">
          {chapter.title}
        </span>
        <span className="text-[var(--text-xs)] text-[var(--color-text-muted)] opacity-0 group-hover:opacity-100 transition-opacity">
          {chapter.wordCount > 0 ? `${chapter.wordCount}` : ""}
        </span>
      </button>
      {dragOver === "after" && (
        <div className="absolute left-2 right-2 bottom-0 h-0.5 bg-[var(--color-primary)] rounded-full" />
      )}
    </div>
  );
}
