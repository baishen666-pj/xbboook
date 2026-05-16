import { useCallback, useState } from "react";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useProjectStore } from "@/stores/projectStore";
import { useEditorStore } from "@/stores/editorStore";
import { useChapterContent } from "@/hooks/useChapterContent";
import { ChapterItem } from "./ChapterItem";
import { Button } from "@/components/ui/Button";
import type { Chapter } from "@/types/project";

interface VolumeGroup {
  volumeId: string;
  volumeTitle: string;
  chapters: Chapter[];
}

function groupByVolume(chapters: Chapter[]): VolumeGroup[] {
  const map = new Map<string, Chapter[]>();

  for (const chapter of chapters) {
    const key = chapter.volumeId || "default";
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key)!.push(chapter);
  }

  if (map.size === 0) {
    return [{ volumeId: "default", volumeTitle: "第一卷", chapters: [] }];
  }

  return Array.from(map.entries()).map(([volumeId, chaps], index) => ({
    volumeId,
    volumeTitle: `第${index + 1}卷`,
    chapters: chaps.sort((a, b) => a.sortOrder - b.sortOrder),
  }));
}

export function VolumeTree({ onBatchPolish }: { onBatchPolish?: () => void }) {
  const chapters = useProjectStore((s) => s.chapters);
  const createChapter = useProjectStore((s) => s.createChapter);
  const reorderChapters = useProjectStore((s) => s.reorderChapters);
  const selectedChapterIds = useProjectStore((s) => s.selectedChapterIds);
  const clearChapterSelection = useProjectStore((s) => s.clearChapterSelection);
  const activeChapterId = useEditorStore((s) => s.activeChapterId);
  const { loadChapter } = useChapterContent();
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [activeChapter, setActiveChapter] = useState<Chapter | null>(null);

  const volumeGroups = groupByVolume(chapters);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const chapter = event.active.data.current?.chapter as Chapter | undefined;
    if (chapter) {
      setActiveChapter(chapter);
    }
  }, []);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeData = active.data.current;
    const overData = over.data.current;
    if (!activeData?.chapter || !overData?.chapter) return;

    const activeChapter = activeData.chapter as Chapter;
    const overChapter = overData.chapter as Chapter;
    const activeVolumeId = activeChapter.volumeId || "default";
    const overVolumeId = overChapter.volumeId || "default";

    if (activeVolumeId !== overVolumeId) {
      const currentChapters = useProjectStore.getState().chapters;
      const targetVolumeKey = overChapter.volumeId || "";

      const updatedChapters = currentChapters.map((ch) => {
        if (ch.id === activeChapter.id) {
          return { ...ch, volumeId: targetVolumeKey };
        }
        return ch;
      });

      const targetGroupChapters = updatedChapters
        .filter((ch) => (ch.volumeId || "") === targetVolumeKey)
        .sort((a, b) => a.sortOrder - b.sortOrder);

      const overIndex = targetGroupChapters.findIndex((ch) => ch.id === overChapter.id);
      if (overIndex === -1) return;

      const withoutActive = targetGroupChapters.filter((ch) => ch.id !== activeChapter.id);
      withoutActive.splice(overIndex, 0, { ...activeChapter, volumeId: targetVolumeKey });

      const reorderedTarget = withoutActive.map((ch, i) => ({ ...ch, sortOrder: i }));
      const reorderedIds = new Set(reorderedTarget.map((ch) => ch.id));

      const finalChapters = updatedChapters.map((ch) => {
        if (reorderedIds.has(ch.id)) {
          return reorderedTarget.find((r) => r.id === ch.id)!;
        }
        return ch;
      });

      useProjectStore.setState({ chapters: finalChapters });
    }
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveChapter(null);

    if (!over || active.id === over.id) return;

    const currentChapters = useProjectStore.getState().chapters;
    const activeChapter = currentChapters.find((c) => c.id === active.id);
    const overChapter = currentChapters.find((c) => c.id === over.id);
    if (!activeChapter || !overChapter) return;

    const targetVolumeId = overChapter.volumeId || "";

    const chaptersInTargetVolume = currentChapters
      .filter((c) => (c.volumeId || "") === targetVolumeId)
      .sort((a, b) => a.sortOrder - b.sortOrder);

    const overIndex = chaptersInTargetVolume.findIndex((c) => c.id === over.id);
    if (overIndex === -1) return;

    const withoutActive = chaptersInTargetVolume.filter((c) => c.id !== active.id);
    withoutActive.splice(overIndex, 0, { ...activeChapter, volumeId: targetVolumeId });

    const items = withoutActive.map((c, i) => ({
      id: c.id,
      volumeId: targetVolumeId || null,
      sortOrder: i,
    }));

    void reorderChapters(items);
  }, [reorderChapters]);

  const handleDragCancel = useCallback(() => {
    setActiveChapter(null);
  }, []);

  async function handleCreateChapter() {
    const chapter = await createChapter("default", undefined);
    if (chapter) {
      await loadChapter(chapter.id);
    }
  }

  function handleToggleSelectMode() {
    if (isSelectMode) {
      clearChapterSelection();
    }
    setIsSelectMode((prev) => !prev);
  }

  function handleCancelSelect() {
    clearChapterSelection();
    setIsSelectMode(false);
  }

  function handleBatchPolish() {
    if (onBatchPolish) {
      onBatchPolish();
    }
  }

  return (
    <div className="p-2">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        {volumeGroups.map((group) => (
          <div key={group.volumeId} className="mb-3">
            <div className="flex items-center justify-between px-2 py-1">
              <span className="text-[var(--text-xs)] font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
                {group.volumeTitle}
              </span>
              <span className="text-[var(--text-xs)] text-[var(--color-text-muted)]">
                {group.chapters.length}
              </span>
            </div>
            <SortableContext
              items={group.chapters.map((c) => c.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="flex flex-col gap-0.5">
                {group.chapters.map((chapter) => (
                  <ChapterItem
                    key={chapter.id}
                    chapter={chapter}
                    isActive={chapter.id === activeChapterId}
                    onClick={() => void loadChapter(chapter.id)}
                    isSelectMode={isSelectMode}
                  />
                ))}
              </div>
            </SortableContext>
          </div>
        ))}

        <DragOverlay>
          {activeChapter ? (
            <div className="rounded-[var(--radius-sm)] bg-[var(--color-surface-2)] px-3 py-1.5 text-[var(--text-sm)] text-[var(--color-text-primary)] shadow-lg border border-[var(--color-border)] opacity-80">
              {activeChapter.title}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {chapters.length === 0 && (
        <div className="py-8 text-center text-[var(--text-sm)] text-[var(--color-text-muted)]">
          暂无章节
        </div>
      )}

      <div className="mt-2 flex items-center gap-1 px-2">
        <Button
          variant="ghost"
          size="sm"
          className="flex-1"
          onClick={() => void handleCreateChapter()}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M8 3v10M3 8h10" />
          </svg>
          新建章节
        </Button>
        <Button
          variant={isSelectMode ? "secondary" : "ghost"}
          size="sm"
          onClick={handleToggleSelectMode}
          title="批量选择"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="2" y="2" width="5" height="5" rx="1" />
            <rect x="9" y="2" width="5" height="5" rx="1" />
            <rect x="2" y="9" width="5" height="5" rx="1" />
            <rect x="9" y="9" width="5" height="5" rx="1" />
          </svg>
          批量
        </Button>
      </div>

      {isSelectMode && selectedChapterIds.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-[var(--color-border)] bg-[var(--color-surface-1)] px-4 py-3 shadow-lg md:bottom-0 bottom-14">
          <div className="flex items-center justify-center gap-3">
            <Button
              variant="primary"
              size="md"
              onClick={handleBatchPolish}
            >
              批量润色 ({selectedChapterIds.length})
            </Button>
            <Button
              variant="ghost"
              size="md"
              onClick={handleCancelSelect}
            >
              取消
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
