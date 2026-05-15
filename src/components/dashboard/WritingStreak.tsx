interface Props {
  current: number;
  longest: number;
}

export function WritingStreak({ current, longest }: Props) {
  return (
    <div className="space-y-1">
      <h3 className="text-xs font-medium text-white/50">连续写作</h3>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold text-[oklch(0.8_0.18_250)]">{current}</span>
        <span className="text-xs text-white/30">天</span>
      </div>
      <div className="text-[10px] text-white/20">最长记录: {longest} 天</div>
    </div>
  );
}
