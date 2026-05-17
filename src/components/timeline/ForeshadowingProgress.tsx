import { useMemo } from "react";
import { useForeshadowingStore } from "@/stores/foreshadowingStore";
import { useProjectStore } from "@/stores/projectStore";
import type { Foreshadowing } from "@/types/project";

const IMPORTANCE_COLORS: Record<string, string> = {
  critical: "text-red-400",
  important: "text-amber-400",
  normal: "text-blue-400",
  minor: "text-white/40",
};

export function ForeshadowingProgress() {
  const foreshadowingItems = useForeshadowingStore((s) => s.items);
  const chapters = useProjectStore((s) => s.chapters);

  const chapterMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const ch of chapters) {
      map.set(ch.id, ch.title);
    }
    return map;
  }, [chapters]);

  const stats = useMemo(() => {
    const total = foreshadowingItems.length;
    const harvested = foreshadowingItems.filter((f) => f.status === "harvested").length;
    const planted = foreshadowingItems.filter((f) => f.status === "planted").length;
    const forgotten = foreshadowingItems.filter((f) => f.status === "forgotten").length;
    const rate = total > 0 ? Math.round((harvested / total) * 100) : 0;
    return { total, harvested, planted, forgotten, rate };
  }, [foreshadowingItems]);

  if (stats.total === 0) {
    return (
      <div>
        <h3 className="text-[var(--text-xs)] font-medium uppercase tracking-wider text-[var(--color-text-muted)] mb-3">
          伏笔进度
        </h3>
        <div className="text-[var(--text-xs)] text-[var(--color-text-muted)] py-2">
          暂无伏笔数据
        </div>
      </div>
    );
  }

  function getChapterTitle(chapterId: string | null): string {
    if (!chapterId) return "-";
    return chapterMap.get(chapterId) ?? "未知章节";
  }

  return (
    <div>
      <h3 className="text-[var(--text-xs)] font-medium uppercase tracking-wider text-[var(--color-text-muted)] mb-3">
        伏笔进度
      </h3>

      {/* Stats cards */}
      <div className="grid grid-cols-4 gap-2 mb-3">
        {[
          { label: "总计", value: stats.total, color: "text-[var(--color-text-primary)]" },
          { label: "已回收", value: stats.harvested, color: "text-emerald-400" },
          { label: "待回收", value: stats.planted, color: "text-amber-400" },
          { label: "遗忘", value: stats.forgotten, color: "text-red-400" },
        ].map((card) => (
          <div key={card.label} className="rounded bg-[var(--color-surface-2)] p-2 text-center">
            <div className={`text-[var(--text-sm)] font-medium ${card.color}`}>{card.value}</div>
            <div className="text-[10px] text-[var(--color-text-muted)]">{card.label}</div>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-[var(--color-text-muted)]">回收率</span>
          <span className="text-[10px] text-[var(--color-primary)]">{stats.rate}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
          <div
            className="h-full rounded-full bg-[var(--color-primary)] transition-all"
            style={{ width: `${stats.rate}%` }}
          />
        </div>
      </div>

      {/* Foreshadowing list */}
      <div className="space-y-1.5">
        {foreshadowingItems.map((fs) => (
          <ForeshadowingItem
            key={fs.id}
            foreshadowing={fs}
            getChapterTitle={getChapterTitle}
          />
        ))}
      </div>
    </div>
  );
}

function ForeshadowingItem({
  foreshadowing: fs,
  getChapterTitle,
}: {
  foreshadowing: Foreshadowing;
  getChapterTitle: (id: string | null) => string;
}) {
  const importanceColor = IMPORTANCE_COLORS[fs.importance] ?? IMPORTANCE_COLORS["normal"]!;

  const statusLabel: Record<string, string> = {
    planted: "待回收",
    harvested: "已回收",
    forgotten: "遗忘",
  };

  const statusColor: Record<string, string> = {
    planted: "text-amber-400",
    harvested: "text-emerald-400",
    forgotten: "text-red-400",
  };

  return (
    <div className="rounded bg-[var(--color-surface-2)] px-2.5 py-1.5">
      <div className="flex items-center gap-1.5">
        <span className={`text-[10px] ${importanceColor}`}>
          {fs.importance === "critical" ? "!!" : fs.importance === "important" ? "!" : "-"}
        </span>
        <span className="text-[var(--text-xs)] text-[var(--color-text-primary)] truncate flex-1">
          {fs.title}
        </span>
        <span className={`text-[10px] ${statusColor[fs.status] ?? ""}`}>
          {statusLabel[fs.status] ?? fs.status}
        </span>
      </div>
      <div className="flex items-center gap-1 mt-0.5 text-[10px] text-[var(--color-text-muted)]">
        <span>{getChapterTitle(fs.plantChapterId)}</span>
        <span className="text-[var(--color-border)]">-&gt;</span>
        {fs.expectedHarvestChapterId && !fs.actualHarvestChapterId && (
          <>
            <span className="opacity-50 line-through">{getChapterTitle(fs.expectedHarvestChapterId)}</span>
            <span className="text-[var(--color-border)]">|</span>
          </>
        )}
        <span>{getChapterTitle(fs.actualHarvestChapterId ?? fs.expectedHarvestChapterId)}</span>
      </div>
    </div>
  );
}
