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
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useProjectStore } from "@/stores/projectStore";
import { useEditorStore } from "@/stores/editorStore";
import { useChapterContent } from "@/hooks/useChapterContent";
import { chapterService } from "@/services/chapterService";
import { streamAi } from "@/services/aiService";
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

function SortableVolumeHeader({ group }: { group: VolumeGroup }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `vol-${group.volumeId}`,
    data: { volumeGroup: group },
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center justify-between px-2 py-1 group"
    >
      <div className="flex items-center gap-1">
        <span
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-[var(--color-text-muted)] opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label="拖拽排序卷"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
            <circle cx="3" cy="2" r="1" /><circle cx="7" cy="2" r="1" />
            <circle cx="3" cy="5" r="1" /><circle cx="7" cy="5" r="1" />
            <circle cx="3" cy="8" r="1" /><circle cx="7" cy="8" r="1" />
          </svg>
        </span>
        <span className="text-[var(--text-xs)] font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
          {group.volumeTitle}
        </span>
      </div>
      <span className="text-[var(--text-xs)] text-[var(--color-text-muted)]">
        {group.chapters.length}
      </span>
    </div>
  );
}

export function VolumeTree({ onBatchPolish }: { onBatchPolish?: () => void }) {
  const currentProject = useProjectStore((s) => s.currentProject);
  const chapters = useProjectStore((s) => s.chapters);
  const createChapter = useProjectStore((s) => s.createChapter);
  const reorderChapters = useProjectStore((s) => s.reorderChapters);
  const reorderVolumes = useProjectStore((s) => s.reorderVolumes);
  const selectedChapterIds = useProjectStore((s) => s.selectedChapterIds);
  const clearChapterSelection = useProjectStore((s) => s.clearChapterSelection);
  const activeChapterId = useEditorStore((s) => s.activeChapterId);
  const { loadChapter } = useChapterContent();
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [activeChapter, setActiveChapter] = useState<Chapter | null>(null);
  const [activeVolumeTitle, setActiveVolumeTitle] = useState<string | null>(null);
  const [polishStatus, setPolishStatus] = useState<string | null>(null);
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"order" | "words" | "updated">("order");

  const allTags = Array.from(
    new Set(
      chapters.flatMap((ch) => {
        const t = (ch as unknown as Record<string, unknown>).tags;
        if (Array.isArray(t)) return t as string[];
        if (typeof t === "string") { try { return JSON.parse(t) as string[]; } catch { return []; } }
        return [];
      })
    )
  ).sort();

  const filteredChapters = chapters.filter((ch) => {
    if (!filterTag) return true;
    const t = (ch as unknown as Record<string, unknown>).tags;
    const tags: string[] = Array.isArray(t) ? t : typeof t === "string" ? (() => { try { return JSON.parse(t); } catch { return []; } })() : [];
    return tags.includes(filterTag);
  });

  const sortedChapters = [...filteredChapters].sort((a, b) => {
    if (sortBy === "words") return (b.wordCount ?? 0) - (a.wordCount ?? 0);
    if (sortBy === "updated") return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
  });

  const volumeGroups = groupByVolume(sortedChapters);

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

  const handleVolumeDragStart = useCallback((event: DragStartEvent) => {
    const group = event.active.data.current?.volumeGroup as VolumeGroup | undefined;
    if (group) setActiveVolumeTitle(group.volumeTitle);
  }, []);

  const handleVolumeDragEnd = useCallback((event: DragEndEvent) => {
    setActiveVolumeTitle(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeGroup = active.data.current?.volumeGroup as VolumeGroup | undefined;
    const overGroup = over.data.current?.volumeGroup as VolumeGroup | undefined;
    if (!activeGroup || !overGroup) return;

    const volumeIds = volumeGroups.map((g) => g.volumeId);
    const oldIndex = volumeIds.indexOf(activeGroup.volumeId);
    const newIndex = volumeIds.indexOf(overGroup.volumeId);
    if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;

    const reordered = [...volumeGroups];
    const [moved] = reordered.splice(oldIndex, 1);
    if (!moved) return;
    reordered.splice(newIndex, 0, moved);

    const items = reordered.map((g, i) => ({ id: g.volumeId, sortOrder: i }));
    void reorderVolumes(items);
  }, [volumeGroups, reorderVolumes]);

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

  const handleBatchPolish = useCallback(async () => {
    if (!currentProject?.id || selectedChapterIds.length === 0) return;
    if (onBatchPolish) { onBatchPolish(); return; }

    const pid = currentProject.id;
    const ids = [...selectedChapterIds];
    const total = ids.length;
    setPolishStatus(`0/${total} 润色中...`);

    for (let i = 0; i < ids.length; i++) {
      const chapterId = ids[i];
      if (!chapterId) continue;
      const chapter = chapters.find((c) => c.id === chapterId);
      if (!chapter) continue;

      setPolishStatus(`${i + 1}/${total} 润色: ${chapter.title}`);

      try {
        let polished = "";
        for await (const event of streamAi({
          projectId: pid,
          skillId: "polish",
          chapterId,
        })) {
          if (event.type === "chunk") polished += event.content;
        }

        if (polished) {
          await chapterService.saveContent(pid, chapterId, polished);
        }
      } catch {
        setPolishStatus(`${i + 1}/${total} 失败: ${chapter.title}`);
      }
    }

    setPolishStatus(`完成: ${total} 章润色`);
    setTimeout(() => setPolishStatus(null), 3000);
    clearChapterSelection();
    setIsSelectMode(false);
  }, [currentProject?.id, selectedChapterIds, chapters, onBatchPolish, clearChapterSelection]);

  return (
    <div className="p-2">
      {/* Filter & Sort bar */}
      {allTags.length > 0 && (
        <div className="flex items-center gap-1.5 px-2 pb-2 flex-wrap">
          <select
            value={filterTag ?? ""}
            onChange={(e) => setFilterTag(e.target.value || null)}
            className="rounded border border-[var(--color-border)] bg-[var(--color-surface-2)] px-1.5 py-0.5 text-[10px] text-[var(--color-text-secondary)] outline-none"
          >
            <option value="">全部标签</option>
            {allTags.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "order" | "words" | "updated")}
            className="rounded border border-[var(--color-border)] bg-[var(--color-surface-2)] px-1.5 py-0.5 text-[10px] text-[var(--color-text-secondary)] outline-none"
          >
            <option value="order">默认排序</option>
            <option value="words">按字数</option>
            <option value="updated">按更新</option>
          </select>
        </div>
      )}

      {/* Volume-level DnD context */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleVolumeDragStart}
        onDragEnd={handleVolumeDragEnd}
        onDragCancel={() => setActiveVolumeTitle(null)}
      >
        <SortableContext
          items={volumeGroups.map((g) => `vol-${g.volumeId}`)}
          strategy={verticalListSortingStrategy}
        >
          {volumeGroups.map((group) => (
            <div key={group.volumeId} className="mb-3">
              <SortableVolumeHeader group={group} />
              {/* Chapter-level DnD context */}
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
                onDragCancel={handleDragCancel}
              >
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
                        onChapterClick={loadChapter}
                        isSelectMode={isSelectMode}
                      />
                    ))}
                  </div>
                </SortableContext>

                <DragOverlay>
                  {activeChapter ? (
                    <div className="rounded-lg bg-[var(--color-surface-2)] px-3 py-2 text-[var(--text-sm)] text-[var(--color-text-primary)] shadow-xl border border-[var(--color-primary)]/30 ring-1 ring-[var(--color-primary)]/10 max-w-[200px] truncate">
                      {activeChapter.title}
                    </div>
                  ) : null}
                </DragOverlay>
              </DndContext>
            </div>
          ))}
        </SortableContext>

        <DragOverlay>
          {activeVolumeTitle ? (
            <div className="rounded-lg bg-[var(--color-surface-2)] px-3 py-1.5 text-[var(--text-xs)] font-medium uppercase tracking-wider text-[var(--color-text-primary)] shadow-xl border border-[var(--color-primary)]/30 ring-1 ring-[var(--color-primary)]/10">
              {activeVolumeTitle}
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
            {polishStatus && (
              <span className="text-[var(--text-xs)] text-[var(--color-primary)]">{polishStatus}</span>
            )}
            <Button
              variant="primary"
              size="md"
              onClick={handleBatchPolish}
              disabled={!!polishStatus}
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
