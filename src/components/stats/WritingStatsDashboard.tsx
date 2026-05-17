import { useState, useEffect } from 'react';
import {
  writingStatsService,
  type StatsOverview,
  type TrendData,
  type HeatmapData,
} from '@/services/writingStatsService';

interface WritingStatsDashboardProps {
  projectId: string;
}

export function WritingStatsDashboard({ projectId }: WritingStatsDashboardProps) {
  const [overview, setOverview] = useState<StatsOverview | null>(null);
  const [trend, setTrend] = useState<TrendData[]>([]);
  const [heatmap, setHeatmap] = useState<HeatmapData[]>([]);
  const [period, setPeriod] = useState<'week' | 'month'>('week');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    Promise.all([
      writingStatsService.getOverview(projectId),
      writingStatsService.getTrend(projectId, period),
      writingStatsService.getHeatmap(projectId),
    ]).then(([overviewRes, trendRes, heatmapRes]) => {
      if (controller.signal.aborted) return;
      if (overviewRes.success && overviewRes.data) setOverview(overviewRes.data);
      if (trendRes.success && trendRes.data) setTrend(trendRes.data);
      if (heatmapRes.success && heatmapRes.data) setHeatmap(heatmapRes.data);
      if (!overviewRes.success) setError(overviewRes.error || '加载失败');
    }).catch((err) => {
      if (!controller.signal.aborted) {
        setError(err instanceof Error ? err.message : '请求失败');
      }
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });

    return () => controller.abort();
  }, [projectId, period]);

  useEffect(() => {
    const controller = new AbortController();
    writingStatsService.getTrend(projectId, period).then((res) => {
      if (controller.signal.aborted) return;
      if (res.success && res.data) setTrend(res.data);
    }).catch(() => {});
    return () => controller.abort();
  }, [projectId, period]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-[10px] text-[var(--color-text-muted)]">
        加载中...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-48 text-[10px] text-red-400">
        {error}
      </div>
    );
  }

  const maxTrendWords = Math.max(...trend.map((t) => t.wordsAdded), 1);
  const maxHeatmap = Math.max(...heatmap.map((h) => h.count), 1);
  const heatmapMap = new Map(heatmap.map((h) => [h.hour, h.count]));

  return (
    <div className="space-y-4 p-3">
      {/* Overview cards */}
      {overview && (
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-1)] p-2.5">
            <div className="text-[10px] text-[var(--color-text-muted)]">总字数</div>
            <div className="mt-0.5 text-sm font-semibold text-[var(--color-text-primary)]">
              {overview.totalWords.toLocaleString()}
            </div>
          </div>
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-1)] p-2.5">
            <div className="text-[10px] text-[var(--color-text-muted)]">写作天数</div>
            <div className="mt-0.5 text-sm font-semibold text-[var(--color-text-primary)]">
              {overview.totalDays}
            </div>
          </div>
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-1)] p-2.5">
            <div className="text-[10px] text-[var(--color-text-muted)]">日均字数</div>
            <div className="mt-0.5 text-sm font-semibold text-[var(--color-text-primary)]">
              {overview.avgDaily.toLocaleString()}
            </div>
          </div>
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-1)] p-2.5">
            <div className="text-[10px] text-[var(--color-text-muted)]">连续天数</div>
            <div className="mt-0.5 text-sm font-semibold text-[var(--color-primary)]">
              {overview.streak}
            </div>
          </div>
        </div>
      )}

      {/* Trend */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] text-[var(--color-text-muted)]">写作趋势</span>
          <div className="flex rounded border border-[var(--color-border)] overflow-hidden">
            <button
              onClick={() => setPeriod('week')}
              className={`px-2 py-0.5 text-[9px] transition-colors ${
                period === 'week'
                  ? 'bg-[var(--color-primary)] text-white'
                  : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)]'
              }`}
            >
              周
            </button>
            <button
              onClick={() => setPeriod('month')}
              className={`px-2 py-0.5 text-[9px] transition-colors ${
                period === 'month'
                  ? 'bg-[var(--color-primary)] text-white'
                  : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)]'
              }`}
            >
              月
            </button>
          </div>
        </div>

        {trend.length > 0 ? (
          <div className="flex items-end gap-px h-20">
            {trend.map((day) => {
              const height = Math.max(2, (day.wordsAdded / maxTrendWords) * 76);
              return (
                <div
                  key={day.date}
                  className="flex-1 rounded-t bg-[var(--color-primary)]/40 hover:bg-[var(--color-primary)]/60 transition-colors"
                  style={{ height: `${height}px` }}
                  title={`${day.date}: +${day.wordsAdded} 字`}
                />
              );
            })}
          </div>
        ) : (
          <div className="h-20 flex items-center justify-center text-[10px] text-[var(--color-text-muted)]">
            暂无趋势数据
          </div>
        )}
      </div>

      {/* Heatmap */}
      <div>
        <div className="text-[10px] text-[var(--color-text-muted)] mb-2">写作时段分布</div>
        <div className="grid grid-cols-12 gap-0.5">
          {Array.from({ length: 24 }, (_, hour) => {
            const count = heatmapMap.get(hour) ?? 0;
            const intensity = maxHeatmap > 0 ? count / maxHeatmap : 0;
            const opacity = Math.max(0.08, intensity * 0.9);
            return (
              <div
                key={hour}
                className="aspect-square rounded-sm bg-[var(--color-primary)]"
                style={{ opacity }}
                title={`${hour}:00 — ${count} 次`}
              />
            );
          })}
        </div>
        <div className="flex justify-between mt-1 text-[9px] text-[var(--color-text-muted)]">
          <span>0:00</span>
          <span>6:00</span>
          <span>12:00</span>
          <span>18:00</span>
          <span>23:00</span>
        </div>
      </div>
    </div>
  );
}
