interface Props {
  data: { date: string; words: number }[];
}

export function WritingVelocityChart({ data }: Props) {
  if (data.length === 0) {
    return <div className="py-4 text-center text-xs text-white/20">暂无写作速度数据</div>;
  }

  const maxWords = Math.max(...data.map((d) => d.words), 1);

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-medium text-white/50">写作速度趋势</h3>
      <div className="flex items-end gap-[2px] h-24">
        {data.map((d) => (
          <div
            key={d.date}
            className="flex-1 rounded-t-sm bg-[oklch(0.65_0.18_250)] min-w-[3px] transition-all hover:bg-[oklch(0.75_0.18_250)]"
            style={{ height: `${(d.words / maxWords) * 100}%` }}
            title={`${d.date}: ${d.words} 字`}
          />
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-white/20">
        <span>{data[0]?.date?.slice(5)}</span>
        <span>{data[data.length - 1]?.date?.slice(5)}</span>
      </div>
    </div>
  );
}
