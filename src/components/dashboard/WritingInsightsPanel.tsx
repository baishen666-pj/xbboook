import { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/services/apiClient";

interface TrendItem {
  label: string;
  words: number;
}

interface AiUsage {
  totalWords: number;
  aiMessages: number;
  rate: number;
}

interface Habits {
  peakHours: { hour: number; count: number }[];
  consistencyScore: number;
  optimalSessionLength: number;
}

interface Productivity {
  avgWordsPerSession: number;
  bestDay: { date: string; words: number } | null;
  avgIntervalDays: number;
}

interface Props {
  projectId: string;
}

function TrendChart({ data }: { data: TrendItem[] }) {
  if (data.length === 0) {
    return <div className="py-2 text-center text-[10px] text-white/20">暂无数据</div>;
  }

  const maxWords = Math.max(...data.map((d) => d.words), 1);

  return (
    <div className="flex items-end gap-[2px] h-16">
      {data.map((d, i) => (
        <div
          key={i}
          className="flex-1 rounded-t-sm min-w-[3px] transition-all group relative"
          style={{ height: `${(d.words / maxWords) * 100}%` }}
        >
          <div className="absolute inset-0 rounded-t-sm bg-[oklch(0.65_0.18_250)] opacity-70 group-hover:opacity-100" />
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block rounded bg-black/80 px-1.5 py-0.5 text-[9px] text-white whitespace-nowrap z-10">
            {d.label}: {d.words} 字
          </div>
        </div>
      ))}
    </div>
  );
}

function AiUsageBar({ data }: { data: AiUsage }) {
  const pct = Math.min(data.rate, 100);
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-semibold text-white/80">{data.rate}%</span>
        <span className="text-[10px] text-white/25">
          {data.aiMessages} 条 AI / {data.totalWords.toLocaleString()} 字
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
        <div
          className="h-full rounded-full bg-[oklch(0.65_0.12_300)] transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function StatCard({ label, value, unit }: { label: string; value: string | number; unit?: string }) {
  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.02] p-2.5">
      <div className="text-[10px] text-white/25">{label}</div>
      <div className="mt-0.5 flex items-baseline gap-1">
        <span className="text-base font-semibold text-white/80">{value}</span>
        {unit && <span className="text-[10px] text-white/25">{unit}</span>}
      </div>
    </div>
  );
}

export function WritingInsightsPanel({ projectId }: Props) {
  const [period, setPeriod] = useState<"week" | "month">("week");
  const [trends, setTrends] = useState<TrendItem[]>([]);
  const [aiUsage, setAiUsage] = useState<AiUsage>({ totalWords: 0, aiMessages: 0, rate: 0 });
  const [habits, setHabits] = useState<Habits>({ peakHours: [], consistencyScore: 0, optimalSessionLength: 0 });
  const [productivity, setProductivity] = useState<Productivity>({ avgWordsPerSession: 0, bestDay: null, avgIntervalDays: 0 });
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [trendRes, aiRes, habitRes, prodRes] = await Promise.all([
      apiClient.get<TrendItem[]>(`/projects/${projectId}/insights/trends?period=${period}`),
      apiClient.get<AiUsage>(`/projects/${projectId}/insights/ai-usage?period=${period}`),
      apiClient.get<Habits>(`/projects/${projectId}/insights/habits`),
      apiClient.get<Productivity>(`/projects/${projectId}/insights/productivity`),
    ]);

    if (trendRes.success && trendRes.data) setTrends(trendRes.data);
    if (aiRes.success && aiRes.data) setAiUsage(aiRes.data);
    if (habitRes.success && habitRes.data) setHabits(habitRes.data);
    if (prodRes.success && prodRes.data) setProductivity(prodRes.data);
    setLoading(false);
  }, [projectId, period]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const topHours = habits.peakHours
    .filter((h) => h.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-medium text-white/50">写作洞察</h3>
        <div className="flex items-center gap-1">
          {(["week", "month"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`rounded px-2 py-0.5 text-[10px] transition-colors ${
                period === p
                  ? "bg-[oklch(0.65_0.18_250)] text-white"
                  : "text-white/30 hover:text-white/60"
              }`}
            >
              {p === "week" ? "周" : "月"}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="py-4 text-center text-xs text-white/20">加载中...</div>
      )}

      {!loading && (
        <>
          {/* Trends */}
          <div className="space-y-1.5">
            <div className="text-[10px] text-white/30">字数趋势</div>
            <TrendChart data={trends} />
          </div>

          {/* AI Usage */}
          <div className="space-y-1.5">
            <div className="text-[10px] text-white/30">AI 使用率</div>
            <AiUsageBar data={aiUsage} />
          </div>

          {/* Habits */}
          <div className="space-y-2">
            <div className="text-[10px] text-white/30">写作习惯</div>
            <div className="grid grid-cols-3 gap-2">
              <StatCard
                label="高峰时段"
                value={topHours.length > 0 ? topHours.map((h) => `${h.hour}:00`).join(", ") : "-"}
              />
              <StatCard label="连续性" value={habits.consistencyScore} unit="%" />
              <StatCard label="最佳时长" value={habits.optimalSessionLength} unit="分钟" />
            </div>
          </div>

          {/* Productivity */}
          <div className="space-y-2">
            <div className="text-[10px] text-white/30">写作效率</div>
            <div className="grid grid-cols-3 gap-2">
              <StatCard label="场均字数" value={productivity.avgWordsPerSession} unit="字" />
              <StatCard
                label="最佳单日"
                value={productivity.bestDay ? productivity.bestDay.words.toLocaleString() : "-"}
                unit={productivity.bestDay ? "字" : undefined}
              />
              <StatCard label="平均间隔" value={productivity.avgIntervalDays} unit="天" />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
