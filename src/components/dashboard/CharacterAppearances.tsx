interface Props {
  data: { name: string; count: number }[];
}

export function CharacterAppearances({ data }: Props) {
  if (data.length === 0) {
    return <div className="py-4 text-center text-xs text-white/20">暂无角色出场数据</div>;
  }

  const maxCount = data[0]?.count ?? 1;
  const top = data.slice(0, 8);

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-medium text-white/50">角色出场排行</h3>
      <div className="space-y-1.5">
        {top.map((d, i) => (
          <div key={d.name} className="flex items-center gap-2 text-xs">
            <span className="w-4 text-right text-white/30">{i + 1}</span>
            <span className="w-16 truncate text-white/60">{d.name}</span>
            <div className="flex-1 h-3 rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full rounded-full bg-[oklch(0.65_0.18_250)] transition-all"
                style={{ width: `${(d.count / maxCount) * 100}%` }}
              />
            </div>
            <span className="w-10 text-right text-white/30">{d.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
