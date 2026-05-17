import { useState } from 'react';
import { coherenceEngineService } from '@/services/coherenceEngineService';

interface CoherencePanelProps {
  projectId: string;
}

const SCOPE_OPTIONS = [
  { value: 'full', label: '全书' },
  { value: 'volume', label: '卷范围' },
  { value: 'chapter', label: '单章' },
] as const;

const CHECK_OPTIONS = [
  { value: 'timeline', label: '时间线' },
  { value: 'character', label: '角色' },
  { value: 'geography', label: '地理' },
  { value: 'setting', label: '设定' },
  { value: 'foreshadowing', label: '伏笔' },
  { value: 'naming', label: '称谓' },
] as const;

const SEVERITY_STYLES = {
  warning: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', border: 'border-yellow-500/20', label: '警告' },
  error: { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/20', label: '错误' },
  critical: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20', label: '严重' },
} as const;

type SeverityStyle = typeof SEVERITY_STYLES[keyof typeof SEVERITY_STYLES];

function getSeverityStyle(severity: string): SeverityStyle {
  if (severity in SEVERITY_STYLES) return SEVERITY_STYLES[severity as keyof typeof SEVERITY_STYLES];
  return SEVERITY_STYLES.warning;
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-400';
  if (score >= 60) return 'text-yellow-400';
  return 'text-red-400';
}

function getScoreBarColor(score: number): string {
  if (score >= 80) return 'bg-green-500';
  if (score >= 60) return 'bg-yellow-500';
  return 'bg-red-500';
}

type CheckResult = {
  type: string;
  score: number;
  issues: { severity: string; description: string; chapters: number[]; suggestion: string }[];
};

type CoherenceData = {
  overall_coherence: number;
  checks: CheckResult[];
  foreshadowing_status: {
    planted_but_unresolved: string[];
    resolved_well: string[];
    orphaned: string[];
  };
  cross_volume_issues: string[];
  recommendations: string[];
};

export function CoherencePanel({ projectId }: CoherencePanelProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CoherenceData | null>(null);

  const [scope, setScope] = useState<string>('full');
  const [volumeStart, setVolumeStart] = useState<number>(1);
  const [volumeEnd, setVolumeEnd] = useState<number>(1);
  const [selectedChecks, setSelectedChecks] = useState<string[]>([]);
  const [expandedChecks, setExpandedChecks] = useState<Set<string>>(new Set());

  const toggleCheck = (value: string) => {
    setSelectedChecks((prev) =>
      prev.includes(value) ? prev.filter((c) => c !== value) : [...prev, value]
    );
  };

  const selectAllChecks = () => {
    setSelectedChecks(CHECK_OPTIONS.map((c) => c.value));
  };

  const toggleExpanded = (type: string) => {
    setExpandedChecks((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  const handleCheck = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setExpandedChecks(new Set());

    try {
      const checks = selectedChecks.length > 0 ? selectedChecks : undefined;
      const payload: Record<string, unknown> = { scope };
      if (scope === 'volume') {
        payload.volumeStart = volumeStart;
        payload.volumeEnd = volumeEnd;
      }
      if (checks) {
        payload.checks = checks;
      }

      const res = await coherenceEngineService.check(projectId, payload as Parameters<typeof coherenceEngineService.check>[1]);
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

  const checkLabel = (type: string): string =>
    CHECK_OPTIONS.find((c) => c.value === type)?.label ?? type;

  return (
    <div className="space-y-3">
      {/* Scope select */}
      <div>
        <div className="text-[10px] text-[var(--color-text-muted)] mb-1">检查范围</div>
        <div className="flex gap-1">
          {SCOPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setScope(opt.value)}
              className={`rounded px-2 py-0.5 text-[10px] transition-colors ${
                scope === opt.value
                  ? 'bg-[var(--color-primary)]/20 text-[var(--color-primary)]'
                  : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-1)]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Volume range inputs */}
      {scope === 'volume' && (
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-[var(--color-text-muted)]">从卷</span>
            <input
              type="number"
              min={1}
              value={volumeStart}
              onChange={(e) => setVolumeStart(Number(e.target.value) || 1)}
              className="w-12 rounded border border-[var(--color-border)] bg-[var(--color-surface-1)] px-1.5 py-0.5 text-xs text-[var(--color-text-primary)] text-center"
            />
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-[var(--color-text-muted)]">到卷</span>
            <input
              type="number"
              min={volumeStart}
              value={volumeEnd}
              onChange={(e) => setVolumeEnd(Number(e.target.value) || volumeStart)}
              className="w-12 rounded border border-[var(--color-border)] bg-[var(--color-surface-1)] px-1.5 py-0.5 text-xs text-[var(--color-text-primary)] text-center"
            />
          </div>
        </div>
      )}

      {/* Checks multi-select */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-[var(--color-text-muted)]">检查项目</span>
          <button
            onClick={selectAllChecks}
            className="text-[10px] text-[var(--color-primary)] hover:opacity-80"
          >
            全选
          </button>
        </div>
        <div className="flex gap-1 flex-wrap">
          {CHECK_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => toggleCheck(opt.value)}
              className={`rounded px-2 py-0.5 text-[10px] transition-colors ${
                selectedChecks.includes(opt.value)
                  ? 'bg-[var(--color-primary)]/20 text-[var(--color-primary)]'
                  : 'bg-[var(--color-surface-1)] text-[var(--color-text-muted)]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Run button */}
      <button
        onClick={handleCheck}
        disabled={loading}
        className="w-full rounded bg-[var(--color-primary)] py-1.5 text-xs text-white hover:opacity-90 disabled:opacity-40 transition-opacity"
      >
        {loading ? '连贯性检查中...' : '开始检查'}
      </button>

      {error && (
        <div className="rounded bg-red-500/10 p-2 text-xs text-red-400">{error}</div>
      )}

      {result && (
        <div className="space-y-3">
          {/* Overall score */}
          <div className="flex items-center justify-center gap-3 p-3 rounded-lg bg-[var(--color-surface-1)]">
            <div className={`text-3xl font-bold ${getScoreColor(result.overall_coherence)}`}>
              {result.overall_coherence}
            </div>
            <div className="text-[10px] text-[var(--color-text-muted)]">/100 连贯性评分</div>
          </div>

          {/* Checks list */}
          {result.checks.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-sm font-medium text-[var(--color-text-primary)]">检查结果</div>
              {result.checks.map((check) => (
                <CheckCard
                  key={check.type}
                  check={check}
                  label={checkLabel(check.type)}
                  isExpanded={expandedChecks.has(check.type)}
                  onToggle={() => toggleExpanded(check.type)}
                />
              ))}
            </div>
          )}

          {/* Foreshadowing status */}
          {result.foreshadowing_status && (
            <div className="space-y-1.5">
              <div className="text-sm font-medium text-[var(--color-text-primary)]">伏笔状态</div>

              {result.foreshadowing_status.planted_but_unresolved.length > 0 && (
                <div className="rounded border border-yellow-500/20 bg-yellow-500/5 p-2">
                  <div className="text-[10px] text-yellow-400 mb-1">已埋设未解决</div>
                  <ul className="space-y-0.5">
                    {result.foreshadowing_status.planted_but_unresolved.map((item, i) => (
                      <li key={i} className="text-xs text-[var(--color-text-primary)]">- {item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {result.foreshadowing_status.resolved_well.length > 0 && (
                <div className="rounded border border-green-500/20 bg-green-500/5 p-2">
                  <div className="text-[10px] text-green-400 mb-1">良好回收</div>
                  <ul className="space-y-0.5">
                    {result.foreshadowing_status.resolved_well.map((item, i) => (
                      <li key={i} className="text-xs text-[var(--color-text-primary)]">- {item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {result.foreshadowing_status.orphaned.length > 0 && (
                <div className="rounded border border-red-500/20 bg-red-500/5 p-2">
                  <div className="text-[10px] text-red-400 mb-1">孤立伏笔</div>
                  <ul className="space-y-0.5">
                    {result.foreshadowing_status.orphaned.map((item, i) => (
                      <li key={i} className="text-xs text-[var(--color-text-primary)]">- {item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {result.foreshadowing_status.planted_but_unresolved.length === 0 &&
                result.foreshadowing_status.resolved_well.length === 0 &&
                result.foreshadowing_status.orphaned.length === 0 && (
                <div className="text-xs text-[var(--color-text-muted)] p-1">无伏笔数据</div>
              )}
            </div>
          )}

          {/* Cross-volume issues */}
          {result.cross_volume_issues.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-sm font-medium text-[var(--color-text-primary)]">跨卷问题</div>
              <div className="space-y-1">
                {result.cross_volume_issues.map((issue, i) => (
                  <div key={i} className="rounded border border-orange-500/20 bg-orange-500/5 p-2 text-xs text-[var(--color-text-primary)]">
                    {issue}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommendations */}
          {result.recommendations.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-sm font-medium text-[var(--color-text-primary)]">改进建议</div>
              <ul className="space-y-1">
                {result.recommendations.map((rec, i) => (
                  <li key={i} className="rounded bg-[var(--color-surface-1)] p-2 text-xs text-[var(--color-text-primary)]">
                    {i + 1}. {rec}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {loading && !result && (
        <div className="py-4 text-center text-xs text-[var(--color-text-muted)]">
          分析中...
        </div>
      )}
    </div>
  );
}

function CheckCard({
  check,
  label,
  isExpanded,
  onToggle,
}: {
  check: CheckResult;
  label: string;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="rounded border border-[var(--color-border)] overflow-hidden">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-2 bg-[var(--color-surface-1)] px-2.5 py-1.5 text-left hover:opacity-80 transition-opacity"
        aria-expanded={isExpanded}
      >
        <svg
          width="10" height="10" viewBox="0 0 12 12"
          className={`text-[var(--color-text-muted)] transition-transform shrink-0 ${isExpanded ? 'rotate-90' : ''}`}
          fill="none" stroke="currentColor" strokeWidth="1.5"
          aria-hidden="true"
        >
          <path d="M4 2l4 4-4 4" />
        </svg>
        <span className="flex-1 text-[10px] text-[var(--color-text-primary)] font-medium truncate">
          {label}
        </span>
        <div className="flex items-center gap-1.5">
          <div className="w-12 h-1.5 rounded-full bg-[var(--color-border)] overflow-hidden">
            <div
              className={`h-full rounded-full ${getScoreBarColor(check.score)}`}
              style={{ width: `${check.score}%` }}
            />
          </div>
          <span className={`text-[10px] font-medium ${getScoreColor(check.score)}`}>
            {check.score}
          </span>
        </div>
      </button>

      {isExpanded && check.issues.length > 0 && (
        <div className="border-t border-[var(--color-border)] p-2 space-y-1">
          {check.issues.map((issue, i) => {
            const style = getSeverityStyle(issue.severity);
            return (
              <div key={i} className={`rounded border ${style.border} ${style.bg} p-1.5`}>
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className={`text-[10px] font-medium ${style.text}`}>{style.label}</span>
                  {issue.chapters.length > 0 && (
                    <span className="text-[10px] text-[var(--color-text-muted)]">
                      第{issue.chapters.join('/')}章
                    </span>
                  )}
                </div>
                <div className="text-xs text-[var(--color-text-primary)]">{issue.description}</div>
                {issue.suggestion && (
                  <div className="mt-0.5 text-[10px] text-green-400">建议: {issue.suggestion}</div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {isExpanded && check.issues.length === 0 && (
        <div className="border-t border-[var(--color-border)] p-2 text-[10px] text-[var(--color-text-muted)]">
          无问题
        </div>
      )}
    </div>
  );
}
