interface Props {
  target: number;
  current: number;
  percentage: number;
}

export function TargetProgress({ target, current, percentage }: Props) {
  if (target === 0) {
    return (
      <div className="space-y-1">
        <h3 className="text-xs font-medium text-white/50">目标进度</h3>
        <div className="text-xs text-white/20">未设定目标字数</div>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <h3 className="text-xs font-medium text-white/50">目标进度</h3>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold text-[oklch(0.8_0.15_140)]">{percentage}%</span>
      </div>
      <div className="h-2 rounded-full bg-white/5 overflow-hidden">
        <div
          className="h-full rounded-full bg-[oklch(0.65_0.18_150)] transition-all"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="text-[10px] text-white/20">
        {current.toLocaleString()} / {target.toLocaleString()} 字
      </div>
    </div>
  );
}
