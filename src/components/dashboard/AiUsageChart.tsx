interface Props {
  data: { date: string; words: number; sessions: number }[];
}

export function AiUsageChart({ data }: Props) {
  if (data.length === 0) {
    return <div className="py-4 text-center text-xs text-white/20">暂无数据</div>;
  }

  const maxWords = Math.max(...data.map((d) => d.words), 1);

  // Weekly aggregation
  const weeks: { label: string; words: number }[] = [];
  for (let i = 0; i < data.length; i += 7) {
    const chunk = data.slice(i, i + 7);
    const total = chunk.reduce((s, d) => s + d.words, 0);
    const label = chunk[0]?.date?.slice(5) ?? '';
    weeks.push({ label, words: total });
  }

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-medium text-white/50">字数趋势</h3>

      {/* Daily bar chart */}
      <div className="space-y-1">
        <div className="text-[10px] text-white/30">每日</div>
        <div className="flex items-end gap-[2px] h-20">
          {data.slice(-30).map((d) => (
            <div
              key={d.date}
              className="flex-1 rounded-t-sm min-w-[3px] transition-all group relative"
              style={{ height: `${(d.words / maxWords) * 100}%` }}
            >
              <div className="absolute inset-0 rounded-t-sm bg-[oklch(0.65_0.18_250)] opacity-80 group-hover:opacity-100" />
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block rounded bg-black/80 px-1.5 py-0.5 text-[9px] text-white whitespace-nowrap z-10">
                {d.date.slice(5)}: {d.words} 字
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Weekly summary */}
      {weeks.length > 1 && (
        <div className="space-y-1">
          <div className="text-[10px] text-white/30">每周</div>
          <div className="flex items-end gap-1 h-12">
            {weeks.map((w, i) => {
              const maxW = Math.max(...weeks.map((x) => x.words), 1);
              return (
                <div
                  key={i}
                  className="flex-1 rounded-t-sm bg-[oklch(0.55_0.12_250)] min-w-[6px]"
                  style={{ height: `${(w.words / maxW) * 100}%` }}
                  title={`${w.label}: ${w.words} 字`}
                />
              );
            })}
          </div>
        </div>
      )}

      <div className="flex justify-between text-[10px] text-white/20">
        <span>{data[0]?.date?.slice(5)}</span>
        <span>{data[data.length - 1]?.date?.slice(5)}</span>
      </div>
    </div>
  );
}
