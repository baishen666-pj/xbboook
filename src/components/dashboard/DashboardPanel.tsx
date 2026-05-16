import { useEffect, useState } from "react";
import { useProjectStore } from "@/stores/projectStore";
import { useAnalyticsStore } from "@/stores/analyticsStore";
import { AiUsageChart } from "./AiUsageChart";
import { WritingHeatmap } from "./WritingHeatmap";
import { ChapterProgressChart } from "./ChapterProgressChart";
import { CharacterAppearances } from "./CharacterAppearances";
import { WritingStreak } from "./WritingStreak";
import { TargetProgress } from "./TargetProgress";
import { CheckInPanel } from "./CheckInPanel";
import { AchievementPanel } from "./AchievementPanel";
import { WritingCalendar } from "./WritingCalendar";

interface Props {
  onClose?: () => void;
}

export function DashboardPanel({ onClose }: Props) {
  const currentProject = useProjectStore((s) => s.currentProject);
  const { dashboard, characters, loading, fetchDashboard, fetchCharacters } = useAnalyticsStore();
  const [days, setDays] = useState(30);

  useEffect(() => {
    if (!currentProject) return;
    fetchDashboard(currentProject.id, days);
    fetchCharacters(currentProject.id);
  }, [currentProject, days, fetchDashboard, fetchCharacters]);

  if (!currentProject) return null;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-white/5 px-4 py-2">
        <h2 className="text-sm font-semibold text-white/80">数据分析</h2>
        <div className="flex items-center gap-2">
          {[7, 14, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`rounded px-2 py-0.5 text-[10px] transition-colors ${
                days === d
                  ? "bg-[oklch(0.65_0.18_250)] text-white"
                  : "text-white/30 hover:text-white/60"
              }`}
            >
              {d}天
            </button>
          ))}
          {onClose && (
            <button onClick={onClose} className="ml-2 text-xs text-white/30 hover:text-white/60">
              ×
            </button>
          )}
        </div>
      </div>

      {loading && !dashboard && (
        <div className="flex-1 flex items-center justify-center text-xs text-white/30">加载中...</div>
      )}

      {dashboard && (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-4 gap-3">
            <div className="rounded-lg bg-white/[0.03] p-3">
              <div className="text-[10px] text-white/30">总字数</div>
              <div className="text-lg font-bold text-white/80">{dashboard.summary.totalWords.toLocaleString()}</div>
            </div>
            <div className="rounded-lg bg-white/[0.03] p-3">
              <div className="text-[10px] text-white/30">写作天数</div>
              <div className="text-lg font-bold text-white/80">{dashboard.summary.totalDays}</div>
            </div>
            <div className="rounded-lg bg-white/[0.03] p-3">
              <div className="text-[10px] text-white/30">日均字数</div>
              <div className="text-lg font-bold text-white/80">{dashboard.summary.avgDaily.toLocaleString()}</div>
            </div>
            <div className="rounded-lg bg-white/[0.03] p-3">
              <div className="text-[10px] text-white/30">最高纪录</div>
              <div className="text-lg font-bold text-[oklch(0.8_0.18_250)]">{dashboard.summary.bestDay?.words ?? 0}</div>
            </div>
          </div>

          {/* Streak + Target */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-white/[0.03] p-3">
              <WritingStreak current={dashboard.streak.current} longest={dashboard.streak.longest} />
            </div>
            <div className="rounded-lg bg-white/[0.03] p-3">
              <TargetProgress target={dashboard.target.target} current={dashboard.target.current} percentage={dashboard.target.percentage} />
            </div>
          </div>

          {/* Enhanced velocity chart */}
          <div className="rounded-lg bg-white/[0.03] p-3">
            <AiUsageChart data={dashboard.velocity} />
          </div>

          {/* Writing heatmap */}
          <div className="rounded-lg bg-white/[0.03] p-3">
            <WritingHeatmap data={dashboard.peakHours} />
          </div>

          {/* Chapter status */}
          <div className="rounded-lg bg-white/[0.03] p-3">
            <ChapterProgressChart data={dashboard.chapterStatus} />
          </div>

          {/* Character appearances */}
          <div className="rounded-lg bg-white/[0.03] p-3">
            <CharacterAppearances data={characters} />
          </div>

          {/* Check-in */}
          <CheckInPanel />

          {/* Achievements */}
          <AchievementPanel />

          {/* Writing calendar */}
          <WritingCalendar />
        </div>
      )}
    </div>
  );
}
