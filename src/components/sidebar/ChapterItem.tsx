import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Chapter } from "@/types/project";
import { LockIndicator } from "@/components/collab/LockIndicator";
import { useProjectStore } from "@/stores/projectStore";

interface ChapterItemProps {
  chapter: Chapter;
  isActive: boolean;
  onClick: () => void;
  isSelectMode?: boolean;
}

const STATUS_DOT: Record<string, string> = {
  draft: "bg-[var(--color-text-muted)]",
  writing: "bg-[var(--color-warning)]",
  revised: "bg-[var(--color-primary)]",
  done: "bg-[var(--color-success)]",
};

export function ChapterItem({ chapter, isActive, onClick, isSelectMode }: ChapterItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: chapter.id, data: { chapter } });

  const selectedChapterIds = useProjectStore((s) => s.selectedChapterIds);
  const toggleChapterSelection = useProjectStore((s) => s.toggleChapterSelection);
  const isSelected = selectedChapterIds.includes(chapter.id);
  const [isHovered, setIsHovered] = useState(false);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <button
        onClick={isSelectMode ? () => toggleChapterSelection(chapter.id) : onClick}
        className={[
          "group flex w-full items-center gap-2 rounded-[var(--radius-sm)] px-3 py-1.5 text-left transition-colors min-h-[36px]",
          isActive && !isSelectMode
            ? "bg-[var(--color-primary-subtle)] text-[var(--color-primary)]"
            : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-primary)]",
          isSelected ? "bg-[var(--color-primary-subtle)]" : "",
        ].join(" ")}
        aria-label={isSelectMode
          ? `${isSelected ? "取消选择" : "选择"} ${chapter.title}`
          : `打开章节 ${chapter.title}`
        }
        aria-pressed={isSelectMode ? isSelected : undefined}
      >
        {isSelectMode && (
          <span
            className={[
              "flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border transition-colors",
              isSelected
                ? "border-[var(--color-primary)] bg-[var(--color-primary)]"
                : "border-[var(--color-border)] bg-transparent",
            ].join(" ")}
          >
            {isSelected && (
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2">
                <path d="M2 6l3 3 5-5" />
              </svg>
            )}
          </span>
        )}
        <span
          {...attributes}
          {...listeners}
          className={[
            "flex-shrink-0 cursor-grab active:cursor-grabbing text-[var(--color-text-muted)] transition-opacity",
            isHovered || isDragging ? "opacity-100" : "opacity-0 group-hover:opacity-100",
          ].join(" ")}
          title="拖拽排序"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
            <circle cx="3" cy="2" r="1.2" />
            <circle cx="9" cy="2" r="1.2" />
            <circle cx="3" cy="6" r="1.2" />
            <circle cx="9" cy="6" r="1.2" />
            <circle cx="3" cy="10" r="1.2" />
            <circle cx="9" cy="10" r="1.2" />
          </svg>
        </span>
        <span
          className={[
            "inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full",
            STATUS_DOT[chapter.status] ?? STATUS_DOT.draft,
          ].join(" ")}
        />
        <span className="flex-1 truncate text-[var(--text-sm)]">
          {chapter.title}
        </span>
        <LockIndicator chapterId={chapter.id} />
        <span className="text-[var(--text-xs)] text-[var(--color-text-muted)] opacity-0 group-hover:opacity-100 transition-opacity">
          {chapter.wordCount > 0 ? `${chapter.wordCount}` : ""}
        </span>
      </button>
    </div>
  );
}
