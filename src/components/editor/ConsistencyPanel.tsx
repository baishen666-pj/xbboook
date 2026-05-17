import { useState } from 'react';
import { consistencyCheckService, type ConsistencyIssue, type ConsistencyResult } from '@/services/consistencyCheckService';

interface ConsistencyPanelProps {
  projectId: string;
}

const TYPE_LABELS: Record<string, string> = {
  timeline: '时间线', character: '角色', geography: '地理', setting: '设定', naming: '称谓',
};

const TYPE_ICONS: Record<string, string> = {
  timeline: '⏰', character: '👤', geography: '🗺️', setting: '⚙️', naming: '📛',
};

export function ConsistencyPanel({ projectId }: ConsistencyPanelProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ConsistencyResult | null>(null);
  const [filter, setFilter] = useState<string>('all');

  const handleCheck = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await consistencyCheckService.check(projectId);
      if (res.success && res.data) {
        setResult(res.data);
      } else {
        setError(res.error || '检查失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '请求失败');
    } finally {
      setLoading(false);
    }
  };

  const filteredIssues = result?.issues?.filter(
    (issue) => filter === 'all' || issue.type === filter
  ) ?? [];

  const issueTypes = result?.issues
    ? [...new Set(result.issues.map((i) => i.type))]
    : [];

  return (
    <div className="space-y-3">
      <button
        onClick={handleCheck}
        disabled={loading}
        className="w-full rounded bg-[var(--color-primary)] py-1.5 text-xs text-white hover:opacity-90 disabled:opacity-40"
      >
        {loading ? '一致性检查中...' : '开始一致性检查'}
      </button>

      {error && (
        <div className="rounded bg-red-500/10 p-2 text-xs text-red-400">{error}</div>
      )}

      {result && (
        <div className="space-y-3">
          {/* Score */}
          <div className="flex items-center justify-center gap-3 p-3 rounded-lg bg-[var(--color-surface-1)]">
            <div className={`text-2xl font-bold ${result.consistency_score >= 80 ? 'text-green-400' : result.consistency_score >= 60 ? 'text-yellow-400' : 'text-red-400'}`}>
              {result.consistency_score}
            </div>
            <div className="text-[10px] text-[var(--color-text-muted)]">/100 一致性评分</div>
          </div>

          {/* Summary */}
          <div className="text-xs text-[var(--color-text-secondary)] p-2 rounded bg-[var(--color-surface-1)]">
            {result.summary}
          </div>

          {/* Filter */}
          {issueTypes.length > 0 && (
            <div className="flex gap-1 flex-wrap">
              <button
                onClick={() => setFilter('all')}
                className={`rounded px-2 py-0.5 text-[10px] ${filter === 'all' ? 'bg-[var(--color-primary)]/20 text-[var(--color-primary)]' : 'text-[var(--color-text-muted)]'}`}
              >
                全部 ({result.issues.length})
              </button>
              {issueTypes.map((t) => (
                <button
                  key={t}
                  onClick={() => setFilter(t)}
                  className={`rounded px-2 py-0.5 text-[10px] ${filter === t ? 'bg-[var(--color-primary)]/20 text-[var(--color-primary)]' : 'text-[var(--color-text-muted)]'}`}
                >
                  {TYPE_ICONS[t] || ''} {TYPE_LABELS[t] || t} ({result.issues.filter((i) => i.type === t).length})
                </button>
              ))}
            </div>
          )}

          {/* Issues */}
          <div className="space-y-1.5">
            {filteredIssues.map((issue, i) => (
              <div key={i} className={`rounded border p-2 ${
                issue.severity === 'error' ? 'border-red-500/30 bg-red-500/5' : 'border-yellow-500/30 bg-yellow-500/5'
              }`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px]">{TYPE_ICONS[issue.type] || '❓'}</span>
                  <span className={`text-[10px] font-medium ${issue.severity === 'error' ? 'text-red-400' : 'text-yellow-400'}`}>
                    {issue.severity === 'error' ? '错误' : '警告'}
                  </span>
                  <span className="text-[10px] text-[var(--color-text-muted)]">{issue.location}</span>
                </div>
                <div className="text-xs text-[var(--color-text-secondary)]">{issue.description}</div>
                {issue.suggestion && (
                  <div className="mt-1 text-[10px] text-green-400">建议: {issue.suggestion}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
