import type { SceneStats } from '@/types/project';

interface SceneStatsBarProps {
  stats: SceneStats;
}

export function SceneStatsBar({ stats }: SceneStatsBarProps) {
  const statusEntries = Object.entries(stats.byStatus);
  const total = stats.total || 1;

  return (
    <div className="flex items-center gap-3 border-b border-[var(--color-border)] px-3 py-2">
      {/* Progress bar */}
      <div className="flex-1">
        <div className="flex h-2 overflow-hidden rounded-full bg-[var(--color-surface-1)]">
          {statusEntries.map(([status, count]) => {
            const pct = (count / total) * 100;
            if (pct === 0) return null;
            const color =
              status === 'done' ? 'bg-emerald-500' :
              status === 'revising' ? 'bg-amber-500' :
              status === 'writing' ? 'bg-blue-500' :
              'bg-gray-500';
            return (
              <div
                key={status}
                className={`${color} transition-all duration-300`}
                style={{ width: `${pct}%` }}
                title={`${status}: ${count}`}
              />
            );
          })}
        </div>
      </div>

      {/* Summary */}
      <div className="shrink-0 flex items-center gap-3 text-[10px] text-[var(--color-text-muted)]">
        <span>{stats.total} 场景</span>
        <span>{stats.totalWords.toLocaleString()} 字</span>
        {statusEntries.map(([status, count]) => (
          <span key={status}>
            {status === 'done' ? '完成' : status === 'writing' ? '写作' : status === 'revising' ? '修改' : '草稿'} {count}
          </span>
        ))}
      </div>
    </div>
  );
}
