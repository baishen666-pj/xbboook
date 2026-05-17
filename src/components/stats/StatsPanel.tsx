import { useState, useEffect } from "react";
import { useProjectStore } from "@/stores/projectStore";
import { statsService, type WritingSession } from "@/services/statsService";
import type { StatsSummary, DailyStat } from "@/types/project";

function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return `${minutes} 分钟`;
  const hours = Math.floor(minutes / 60);
  const remain = minutes % 60;
  return remain > 0 ? `${hours}h ${remain}m` : `${hours}h`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const hour = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${month}/${day} ${hour}:${min}`;
}

export function StatsPanel() {
  const currentProject = useProjectStore((s) => s.currentProject);
  const [summary, setSummary] = useState<StatsSummary | null>(null);
  const [recent, setRecent] = useState<DailyStat[]>([]);
  const [sessions, setSessions] = useState<WritingSession[]>([]);

  useEffect(() => {
    if (!currentProject) return;
    const controller = new AbortController();
    statsService.getStats(currentProject.id).then((res) => {
      if (!controller.signal.aborted && res.success && res.data) {
        setSummary(res.data.summary);
        setRecent(res.data.recent);
      }
    }).catch(() => {});
    statsService.getSessions(currentProject.id, 15).then((res) => {
      if (!controller.signal.aborted && res.success && res.data) {
        setSessions(res.data);
      }
    }).catch(() => {});
    return () => controller.abort();
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
                  style={{ height: `${height}px` }}
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

      {/* Writing sessions */}
      {sessions.length > 0 && (
        <div>
          <div className="text-xs text-white/30 mb-2">最近写作记录</div>
          <div className="space-y-1">
            {sessions.slice(0, 10).map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between rounded border border-white/5 bg-white/[0.02] px-2.5 py-1.5"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] text-white/60 truncate">{s.chapterTitle}</div>
                  <div className="text-[10px] text-white/25">{formatTime(s.startedAt)}</div>
                </div>
                <div className="text-right shrink-0 ml-2">
                  <div className="text-[11px] font-medium text-white/50">
                    {s.wordsDelta > 0 ? "+" : ""}{s.wordsDelta}
                  </div>
                  {s.durationMs > 0 && (
                    <div className="text-[10px] text-white/20">{formatDuration(s.durationMs)}</div>
                  )}
                </div>
              </div>
            ))}
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
