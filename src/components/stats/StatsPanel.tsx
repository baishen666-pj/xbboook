import { useState, useEffect } from "react";
import { useProjectStore } from "@/stores/projectStore";
import { statsService } from "@/services/statsService";
import type { StatsSummary, DailyStat } from "@/types/project";

export function StatsPanel() {
  const currentProject = useProjectStore((s) => s.currentProject);
  const [summary, setSummary] = useState<StatsSummary | null>(null);
  const [recent, setRecent] = useState<DailyStat[]>([]);

  useEffect(() => {
    if (!currentProject) return;
    statsService.getStats(currentProject.id).then((res) => {
      if (res.success && res.data) {
        setSummary(res.data.summary);
        setRecent(res.data.recent);
      }
    });
  }, [currentProject]);

  if (!currentProject) return null;

  const maxWords = Math.max(...recent.map((r) => r.wordsAdded), 1);

  return (
    <div className="p-3 space-y-4">
      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
            <div className="text-xs text-white/30">总字数</div>
            <div className="mt-1 text-lg font-semibold text-white/80">{summary.totalWords.toLocaleString()}</div>
          </div>
          <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
            <div className="text-xs text-white/30">写作天数</div>
            <div className="mt-1 text-lg font-semibold text-white/80">{summary.totalDays}</div>
          </div>
          <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
            <div className="text-xs text-white/30">日均字数</div>
            <div className="mt-1 text-lg font-semibold text-white/80">{summary.avgDaily.toLocaleString()}</div>
          </div>
          <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
            <div className="text-xs text-white/30">最高记录</div>
            <div className="mt-1 text-lg font-semibold text-white/80">
              {summary.bestDay ? summary.bestDay.words.toLocaleString() : "—"}
            </div>
            {summary.bestDay && (
              <div className="text-[10px] text-white/20">{summary.bestDay.date}</div>
            )}
          </div>
        </div>
      )}

      {/* Recent chart (simple bar) */}
      {recent.length > 0 && (
        <div>
          <div className="text-xs text-white/30 mb-2">近 30 天写作量</div>
          <div className="flex items-end gap-px h-24">
            {recent.slice(-30).map((day) => {
              const height = Math.max(2, (day.wordsAdded / maxWords) * 96);
              return (
                <div
                  key={day.date}
                  className="flex-1 rounded-t bg-[var(--color-primary)]/40 hover:bg-[var(--color-primary)]/60 transition-colors"
                  style={{ height: `${height}%` }}
                  title={`${day.date}: ${day.wordsAdded} 字`}
                />
              );
            })}
          </div>
          <div className="flex justify-between mt-1 text-[10px] text-white/20">
            <span>{recent[0]?.date.slice(5)}</span>
            <span>{recent[recent.length - 1]?.date.slice(5)}</span>
          </div>
        </div>
      )}

      {recent.length === 0 && !summary?.totalDays && (
        <div className="py-8 text-center text-xs text-white/20">
          暂无写作统计数据
        </div>
      )}
    </div>
  );
}
