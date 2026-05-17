import { useEffect, useState } from "react";
import { useProjectStore } from "@/stores/projectStore";
import { useForeshadowingStore } from "@/stores/foreshadowingStore";
import { useStoryArcStore } from "@/stores/storyArcStore";
import { ChapterTimeline } from "./ChapterTimeline";
import { ForeshadowingProgress } from "./ForeshadowingProgress";
import { ArcTracker } from "./ArcTracker";

type ViewFilter = "all" | "foreshadowing" | "arcs";

export function TimelinePanel() {
  const currentProject = useProjectStore((s) => s.currentProject);
  const fetchForeshadowing = useForeshadowingStore((s) => s.fetchForeshadowing);
  const fetchArcs = useStoryArcStore((s) => s.fetchArcs);
  const fetchThreads = useStoryArcStore((s) => s.fetchThreads);
  const [filter, setFilter] = useState<ViewFilter>("all");

  useEffect(() => {
    if (currentProject) {
      void fetchForeshadowing(currentProject.id);
      void fetchArcs(currentProject.id);
      void fetchThreads(currentProject.id);
    }
  }, [currentProject?.id, fetchForeshadowing, fetchArcs, fetchThreads]);

  if (!currentProject) {
    return <div className="p-4 text-center text-[var(--text-sm)] text-[var(--color-text-muted)]">请先选择一个作品</div>;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Filter tabs */}
      <div className="flex border-b border-[var(--color-border)] px-2 pt-2 gap-1">
        {([
          { key: "all" as ViewFilter, label: "全部" },
          { key: "foreshadowing" as ViewFilter, label: "伏笔" },
          { key: "arcs" as ViewFilter, label: "弧线" },
        ]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`rounded-t px-2.5 py-1 text-[var(--text-xs)] transition-colors ${
              filter === tab.key
                ? "bg-[var(--color-surface-2)] text-[var(--color-primary)]"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {(filter === "all" || filter === "foreshadowing") && (
          <>
            <ForeshadowingProgress />
            <ChapterTimeline />
          </>
        )}
        {(filter === "all" || filter === "arcs") && (
          <ArcTracker />
        )}
      </div>
    </div>
  );
}
