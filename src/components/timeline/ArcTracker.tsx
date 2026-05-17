import { useMemo, useState } from "react";
import { useStoryArcStore } from "@/stores/storyArcStore";
import { useProjectStore } from "@/stores/projectStore";

const ARC_STATUS_STYLES: Record<string, { label: string; color: string; barColor: string }> = {
  planned: { label: "规划中", color: "text-white/40", barColor: "bg-white/20" },
  active: { label: "进行中", color: "text-amber-400", barColor: "bg-amber-400" },
  completed: { label: "已完成", color: "text-emerald-400", barColor: "bg-emerald-400" },
  abandoned: { label: "已废弃", color: "text-red-400", barColor: "bg-red-400/50" },
};

const THREAD_PRIORITY_COLORS: Record<string, string> = {
  critical: "text-red-400",
  high: "text-amber-400",
  normal: "text-blue-400",
  low: "text-white/40",
};

export function ArcTracker() {
  const arcs = useStoryArcStore((s) => s.arcs);
  const threads = useStoryArcStore((s) => s.threads);
  const chapters = useProjectStore((s) => s.chapters);
  const [expandedArcId, setExpandedArcId] = useState<string | null>(null);

  const totalChapters = chapters.length;

  const arcsWithProgress = useMemo(() => {
    return arcs.map((arc) => {
      const start = arc.start_chapter ?? 1;
      const end = arc.end_chapter ?? totalChapters;
      const progress = totalChapters > 0
        ? Math.min(100, Math.round(((end - start + 1) / totalChapters) * 100))
        : 0;
      const arcThreads = threads.filter((t) => t.arc_id === arc.id);
      return { ...arc, start, end, progress, threads: arcThreads };
    });
  }, [arcs, threads, totalChapters]);

  if (arcs.length === 0) {
    return (
      <div>
        <h3 className="text-[var(--text-xs)] font-medium uppercase tracking-wider text-[var(--color-text-muted)] mb-3">
          故事弧线
        </h3>
        <div className="text-[var(--text-xs)] text-[var(--color-text-muted)] py-2">
          暂无弧线数据
        </div>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-[var(--text-xs)] font-medium uppercase tracking-wider text-[var(--color-text-muted)] mb-3">
        故事弧线
      </h3>
      <div className="space-y-2">
        {arcsWithProgress.map((arc) => {
          const style = ARC_STATUS_STYLES[arc.status] ?? ARC_STATUS_STYLES["planned"]!;
          const isExpanded = expandedArcId === arc.id;

          return (
            <div key={arc.id} className="rounded bg-[var(--color-surface-2)]">
              {/* Arc header */}
              <button
                className="w-full flex items-center gap-2 px-2.5 py-2 text-left"
                onClick={() => setExpandedArcId(isExpanded ? null : arc.id)}
              >
                <span className="text-[10px] text-[var(--color-text-muted)]">
                  {isExpanded ? "v" : ">"}
                </span>
                <span className="text-[var(--text-sm)] text-[var(--color-text-primary)] truncate flex-1">
                  {arc.name}
                </span>
                <span className={`text-[10px] ${style.color}`}>{style.label}</span>
              </button>

              {/* Progress bar */}
              <div className="px-2.5 pb-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-[var(--color-text-muted)]">
                    Ch.{arc.start}
                  </span>
                  <div className="flex-1 h-1 rounded-full bg-white/5 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${style.barColor} transition-all`}
                      style={{ width: `${arc.progress}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-[var(--color-text-muted)]">
                    Ch.{arc.end}
                  </span>
                </div>
              </div>

              {/* Expanded threads */}
              {isExpanded && arc.threads.length > 0 && (
                <div className="border-t border-[var(--color-border)] px-2.5 py-1.5 space-y-1">
                  {arc.threads.map((thread) => {
                    const prColor = THREAD_PRIORITY_COLORS[thread.priority] ?? THREAD_PRIORITY_COLORS["normal"]!;
                    const thStatusColor =
                      thread.status === "resolved"
                        ? "text-emerald-400"
                        : thread.status === "dormant"
                          ? "text-amber-400"
                          : thread.status === "abandoned"
                            ? "text-red-400"
                            : "text-white/40";
                    return (
                      <div key={thread.id} className="flex items-center gap-1.5">
                        <span className={`text-[10px] ${prColor}`}>
                          {thread.priority === "critical" ? "!!" : thread.priority === "high" ? "!" : "-"}
                        </span>
                        <span className="text-[var(--text-xs)] text-[var(--color-text-secondary)] truncate flex-1">
                          {thread.name}
                        </span>
                        <span className={`text-[10px] ${thStatusColor}`}>
                          {thread.status === "open" ? "开放" : thread.status === "resolved" ? "解决" : thread.status === "dormant" ? "休眠" : "废弃"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
