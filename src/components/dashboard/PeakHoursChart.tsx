interface Props {
  data: { hour: number; count: number }[];
}

export function PeakHoursChart({ data }: Props) {
  const maxCount = Math.max(...data.map((d) => d.count), 1);
  const peak = data.length > 0 ? data.reduce((a, b) => (b.count > a.count ? b : a)) : null;

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-medium text-white/50">最佳写作时段</h3>
      <div className="flex items-end gap-[1px] h-16">
        {data.map((d) => (
          <div
            key={d.hour}
            className={`flex-1 rounded-t-sm min-w-[2px] transition-all ${
              d.hour === peak?.hour
                ? "bg-[oklch(0.8_0.18_250)]"
                : "bg-white/10 hover:bg-white/20"
            }`}
            style={{ height: `${(d.count / maxCount) * 100}%` }}
            title={`${d.hour}:00 — ${d.count} 次`}
          />
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-white/20">
        <span>0时</span>
        <span>6时</span>
        <span>12时</span>
        <span>18时</span>
        <span>23时</span>
      </div>
    </div>
  );
}
