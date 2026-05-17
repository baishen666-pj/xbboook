import { useMemo } from "react";
import { useProjectStore } from "@/stores/projectStore";
import { useEditorStore } from "@/stores/editorStore";
import { useForeshadowingStore } from "@/stores/foreshadowingStore";
import { useStoryArcStore } from "@/stores/storyArcStore";
import { useChapterContent } from "@/hooks/useChapterContent";
import type { Foreshadowing, Chapter } from "@/types/project";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-white/20",
  writing: "bg-blue-400",
  revised: "bg-amber-400",
  done: "bg-emerald-400",
};

const FS_STATUS_ICONS: Record<string, string> = {
  planted: "S",
  harvested: "H",
  forgotten: "F",
};

const FS_STATUS_COLORS: Record<string, string> = {
  planted: "bg-emerald-500/20 text-emerald-400",
  harvested: "bg-blue-500/20 text-blue-400",
  forgotten: "bg-red-500/20 text-red-400",
};

export function ChapterTimeline() {
  const chapters = useProjectStore((s) => s.chapters);
  const activeChapterId = useEditorStore((s) => s.activeChapterId);
  const foreshadowingItems = useForeshadowingStore((s) => s.items);
  const arcs = useStoryArcStore((s) => s.arcs);
  const { loadChapter } = useChapterContent();

  const sortedChapters = useMemo(
    () => [...chapters].sort((a, b) => a.sortOrder - b.sortOrder),
    [chapters]
  );

  const foreshadowingByChapter = useMemo(() => {
    const map = new Map<string, Foreshadowing[]>();
    for (const ch of chapters) {
      const related = foreshadowingItems.filter(
        (f) =>
          f.plantChapterId === ch.id ||
          f.actualHarvestChapterId === ch.id ||
          f.expectedHarvestChapterId === ch.id
      );
      if (related.length > 0) {
        map.set(ch.id, related);
      }
    }
    return map;
  }, [chapters, foreshadowingItems]);

  const arcsByChapter = useMemo(() => {
    const map = new Map<string, typeof arcs>();
    for (const ch of sortedChapters) {
      const idx = sortedChapters.indexOf(ch);
      const related = arcs.filter((arc) => {
        const start = arc.start_chapter;
        const end = arc.end_chapter;
        if (start === null && end === null) return false;
        return (start !== null && start <= idx + 1) && (end === null || end >= idx + 1);
      });
      if (related.length > 0) {
        map.set(ch.id, related);
      }
    }
    return map;
  }, [sortedChapters, arcs]);

  if (sortedChapters.length === 0) {
    return (
      <div className="py-6 text-center text-[var(--text-xs)] text-[var(--color-text-muted)]">
        暂无章节
      </div>
    );
  }

  function handleChapterClick(chapter: Chapter) {
    void loadChapter(chapter.id);
  }

  return (
    <div>
      <h3 className="text-[var(--text-xs)] font-medium uppercase tracking-wider text-[var(--color-text-muted)] mb-3">
        章节时间线
      </h3>
      <div className="relative pl-4">
        {/* Vertical line */}
        <div className="absolute left-[7px] top-2 bottom-2 w-px bg-[var(--color-border)]" />

        {sortedChapters.map((chapter, index) => {
          const isActive = chapter.id === activeChapterId;
          const dotColor = STATUS_COLORS[chapter.status] ?? STATUS_COLORS["draft"]!;
          const chapterFs = foreshadowingByChapter.get(chapter.id) ?? [];
          const chapterArcs = arcsByChapter.get(chapter.id) ?? [];

          return (
            <div
              key={chapter.id}
              className={`relative flex items-start gap-3 pb-4 last:pb-0 cursor-pointer group ${
                isActive ? "" : ""
              }`}
              onClick={() => handleChapterClick(chapter)}
            >
              {/* Timeline dot */}
              <div
                className={`relative z-10 mt-1.5 h-3 w-3 rounded-full flex-shrink-0 ring-2 ring-[var(--color-surface-1)] ${
                  isActive ? "ring-[var(--color-primary)]/30" : ""
                } ${dotColor}`}
              />

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-[var(--color-text-muted)] font-mono w-5 flex-shrink-0">
                    {index + 1}
                  </span>
                  <span
                    className={`text-[var(--text-sm)] truncate ${
                      isActive
                        ? "text-[var(--color-primary)] font-medium"
                        : "text-[var(--color-text-primary)] group-hover:text-[var(--color-primary)]"
                    } transition-colors`}
                  >
                    {chapter.title}
                  </span>
                  {chapter.wordCount > 0 && (
                    <span className="text-[10px] text-[var(--color-text-muted)] flex-shrink-0">
                      {chapter.wordCount}字
                    </span>
                  )}
                </div>

                {/* Foreshadowing tags */}
                {chapterFs.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1 ml-5">
                    {chapterFs.map((fs) => {
                      const icon = FS_STATUS_ICONS[fs.status] ?? "?";
                      const color = FS_STATUS_COLORS[fs.status] ?? FS_STATUS_COLORS["planted"]!;
                      return (
                        <span
                          key={fs.id}
                          className={`rounded px-1 py-px text-[9px] ${color}`}
                          title={`${fs.title} (${fs.status})`}
                        >
                          {icon} {fs.title}
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* Arc tags */}
                {chapterArcs.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1 ml-5">
                    {chapterArcs.map((arc) => {
                      const arcStatusColor =
                        arc.status === "active"
                          ? "bg-amber-500/20 text-amber-400"
                          : arc.status === "completed"
                            ? "bg-emerald-500/20 text-emerald-400"
                            : "bg-white/5 text-white/40";
                      return (
                        <span
                          key={arc.id}
                          className={`rounded px-1 py-px text-[9px] ${arcStatusColor}`}
                          title={arc.name}
                        >
                          {arc.name}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
