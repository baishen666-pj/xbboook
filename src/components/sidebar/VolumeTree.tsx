import { useCallback } from "react";
import { useProjectStore } from "@/stores/projectStore";
import { useEditorStore } from "@/stores/editorStore";
import { useChapterContent } from "@/hooks/useChapterContent";
import { chapterService } from "@/services/chapterService";
import { ChapterItem } from "./ChapterItem";
import { Button } from "@/components/ui/Button";

export function VolumeTree() {
  const chapters = useProjectStore((s) => s.chapters);
  const createChapter = useProjectStore((s) => s.createChapter);
  const activeChapterId = useEditorStore((s) => s.activeChapterId);
  const { loadChapter } = useChapterContent();

  const handleReorder = useCallback(
    async (dragId: string, dropId: string, position: "before" | "after") => {
      const currentChapters = useProjectStore.getState().chapters;
      const dragIdx = currentChapters.findIndex((c) => c.id === dragId);
      const dropIdx = currentChapters.findIndex((c) => c.id === dropId);
      if (dragIdx === -1 || dropIdx === -1) return;

      const reordered = [...currentChapters];
      const [removed] = reordered.splice(dragIdx, 1);
      if (!removed) return;
      const newIdx = position === "before" ? dropIdx : dropIdx + 1;
      reordered.splice(newIdx > dragIdx ? newIdx - 1 : newIdx, 0, removed);

      const items = reordered.map((c, i) => ({ id: c.id, sortOrder: i }));
      useProjectStore.setState({ chapters: reordered });

      await chapterService.reorder(items);
    },
    []
  );

  // Group chapters by volumeId. For now, treat all as "default" volume
  const volumeGroups = groupByVolume(chapters);

  async function handleCreateChapter() {
    const chapter = await createChapter("default", undefined);
    if (chapter) {
      await loadChapter(chapter.id);
    }
  }

  return (
    <div className="p-2">
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
          <div className="flex flex-col gap-0.5">
            {group.chapters.map((chapter) => (
              <ChapterItem
                key={chapter.id}
                chapter={chapter}
                isActive={chapter.id === activeChapterId}
                onClick={() => void loadChapter(chapter.id)}
                onReorder={handleReorder}
              />
            ))}
          </div>
        </div>
      ))}

      {chapters.length === 0 && (
        <div className="py-8 text-center text-[var(--text-sm)] text-[var(--color-text-muted)]">
          No chapters yet
        </div>
      )}

      <div className="mt-2 px-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-full"
          onClick={() => void handleCreateChapter()}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M8 3v10M3 8h10" />
          </svg>
          New Chapter
        </Button>
      </div>
    </div>
  );
}

interface VolumeGroup {
  volumeId: string;
  volumeTitle: string;
  chapters: Chapter[];
}

import type { Chapter } from "@/types/project";

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
    return [{ volumeId: "default", volumeTitle: "Volume 1", chapters: [] }];
  }

  return Array.from(map.entries()).map(([volumeId, chaps], index) => ({
    volumeId,
    volumeTitle: `Volume ${index + 1}`,
    chapters: chaps.sort((a, b) => a.sortOrder - b.sortOrder),
  }));
}
