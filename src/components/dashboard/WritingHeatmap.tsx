interface Props {
  data: { hour: number; count: number }[];
}

export function WritingHeatmap({ data }: Props) {
  if (data.length === 0) {
    return <div className="py-4 text-center text-xs text-white/20">暂无数据</div>;
  }

  const maxCount = Math.max(...data.map((d) => d.count), 1);

  // Build 7x24 grid (days x hours) - simplified to show hourly distribution
  const hours = Array.from({ length: 24 }, (_, i) => {
    const found = data.find((d) => d.hour === i);
    return { hour: i, count: found?.count ?? 0 };
  });

  const getColor = (count: number) => {
    const ratio = count / maxCount;
    if (ratio === 0) return 'bg-white/[0.02]';
    if (ratio < 0.25) return 'bg-[oklch(0.35_0.08_250)]';
    if (ratio < 0.5) return 'bg-[oklch(0.50_0.12_250)]';
    if (ratio < 0.75) return 'bg-[oklch(0.65_0.18_250)]';
    return 'bg-[oklch(0.80_0.18_250)]';
  };

  const peak = hours.reduce((a, b) => (b.count > a.count ? b : a));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-medium text-white/50">写作时段热力图</h3>
        <span className="text-[10px] text-[oklch(0.8_0.18_250)]">
          最活跃: {peak.hour}:00
        </span>
      </div>

      {/* Hourly heatmap grid */}
      <div className="grid grid-cols-12 gap-[2px]">
        {hours.map((h) => (
          <div
            key={h.hour}
            className={`aspect-square rounded-sm ${getColor(h.count)} transition-colors hover:ring-1 hover:ring-white/20`}
            title={`${h.hour}:00 — ${h.count} 次`}
          />
        ))}
      </div>

      {/* Hour labels */}
      <div className="grid grid-cols-12 gap-[2px] text-[8px] text-white/20">
        {hours.filter((_, i) => i % 2 === 0).map((h) => (
          <div key={h.hour} className="text-center">{h.hour}</div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-end gap-1 text-[9px] text-white/30">
        <span>少</span>
        <div className="flex gap-[2px]">
          <div className="h-2 w-2 rounded-sm bg-white/[0.02]" />
          <div className="h-2 w-2 rounded-sm bg-[oklch(0.35_0.08_250)]" />
          <div className="h-2 w-2 rounded-sm bg-[oklch(0.50_0.12_250)]" />
          <div className="h-2 w-2 rounded-sm bg-[oklch(0.65_0.18_250)]" />
          <div className="h-2 w-2 rounded-sm bg-[oklch(0.80_0.18_250)]" />
        </div>
        <span>多</span>
      </div>
    </div>
  );
}
