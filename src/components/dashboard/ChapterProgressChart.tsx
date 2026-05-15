interface Props {
  data: { status: string; count: number }[];
}

const STATUS_LABELS: Record<string, string> = {
  draft: "草稿",
  writing: "写作中",
  revised: "已修改",
  done: "已完成",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "oklch(0.5 0.1 250)",
  writing: "oklch(0.65 0.18 250)",
  revised: "oklch(0.7 0.15 140)",
  done: "oklch(0.65 0.18 150)",
};

export function ChapterProgressChart({ data }: Props) {
  const total = data.reduce((s, d) => s + d.count, 0);

  if (total === 0) {
    return <div className="py-4 text-center text-xs text-white/20">暂无章节数据</div>;
  }

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-medium text-white/50">章节进度</h3>
      <div className="flex h-4 rounded-full overflow-hidden bg-white/5">
        {data.map((d) => (
          <div
            key={d.status}
            className="transition-all"
            style={{
              width: `${(d.count / total) * 100}%`,
              backgroundColor: `oklch(${STATUS_COLORS[d.status] ?? "0.5 0 0"})`,
            }}
            title={`${STATUS_LABELS[d.status] ?? d.status}: ${d.count}`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-3 text-[10px] text-white/40">
        {data.map((d) => (
          <span key={d.status} className="flex items-center gap-1">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: STATUS_COLORS[d.status] ?? "oklch(0.5 0 0)" }}
            />
            {STATUS_LABELS[d.status] ?? d.status} {d.count}
          </span>
        ))}
      </div>
    </div>
  );
}
