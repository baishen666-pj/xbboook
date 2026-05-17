import { useState } from 'react';
import { retentionPredictService } from '@/services/retentionPredictService';

interface RetentionPanelProps {
  projectId: string;
}

const FOCUS_OPTIONS = [
  { value: 'all', label: '全部' },
  { value: 'retention', label: '留存' },
  { value: 'dropoff', label: '流失' },
  { value: 'engagement', label: '参与度' },
];

const DEFAULT_RISK_STYLE = { bg: 'bg-gray-500/10', text: 'text-gray-400', border: 'border-gray-500/20' };

const RISK_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  low: { bg: 'bg-green-500/10', text: 'text-green-400', border: 'border-green-500/20' },
  medium: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', border: 'border-yellow-500/20' },
  high: { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/20' },
  critical: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20' },
};

const RISK_LABELS: Record<string, string> = {
  low: '低风险',
  medium: '中等',
  high: '高风险',
  critical: '危险',
};

const TREND_LABELS: Record<string, string> = {
  up: '上升',
  down: '下降',
  stable: '平稳',
};

export function RetentionPanel({ projectId }: RetentionPanelProps) {
  const [focus, setFocus] = useState('all');
  const [result, setResult] = useState<{
    overall_retention: { score: number; trend: string };
    chapter_analysis: { chapter: number; title: string; retention_score: number; dropoff_risk: string; risk_factors: string[]; hook_quality: number; cliffhanger_strength: number; suggestions: string[] }[];
    critical_dropoff_points: { chapter: number; risk: string; reason: string }[];
    engagement_peaks: { chapter: number; reason: string }[];
    recommendations: string[];
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handlePredict = async () => {
    setIsLoading(true);
    setError('');
    try {
      const res = await retentionPredictService.predict(projectId, { focus });
      if (res.success && res.data) {
        setResult(res.data);
      } else {
        setError(res.error ?? '预测失败');
      }
    } catch {
      setError('请求失败');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Controls */}
      <div className="border-b border-[var(--color-border)] p-2 space-y-2">
        <div className="text-sm font-medium text-[var(--color-text-primary)]">读者留存预测</div>
        <div className="flex items-center gap-2">
          <select
            value={focus}
            onChange={(e) => setFocus(e.target.value)}
            className="flex-1 rounded border border-[var(--color-border)] bg-[var(--color-surface-0)] px-2 py-1 text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary)]/50"
          >
            {FOCUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <button
            onClick={handlePredict}
            disabled={isLoading}
            className="rounded bg-[var(--color-primary)] px-3 py-1 text-xs text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {isLoading ? '预测中...' : '预测'}
          </button>
        </div>
        {error && <div className="text-[10px] text-red-400">{error}</div>}
      </div>

      {isLoading && (
        <div className="p-4 text-center text-xs text-[var(--color-text-muted)]">预测中...</div>
      )}

      {!isLoading && result && (
        <div className="flex-1 overflow-y-auto p-2 space-y-3">
          {/* Overall retention */}
          <div className="rounded border border-[var(--color-border)] bg-[var(--color-surface-1)] p-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-[var(--color-text-muted)]">留存评分</span>
              <div className="flex items-center gap-2">
                <span className={`text-sm font-bold ${result.overall_retention.score >= 70 ? 'text-emerald-400' : result.overall_retention.score >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
                  {result.overall_retention.score}
                </span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                  result.overall_retention.trend === 'up' ? 'bg-green-500/10 text-green-400' :
                  result.overall_retention.trend === 'down' ? 'bg-red-500/10 text-red-400' :
                  'bg-[var(--color-surface-1)] text-[var(--color-text-muted)]'
                }`}>
                  {TREND_LABELS[result.overall_retention.trend] ?? result.overall_retention.trend}
                </span>
              </div>
            </div>
          </div>

          {/* Chapter analysis cards */}
          <div className="space-y-1.5">
            <div className="text-[10px] text-[var(--color-text-muted)]">章节分析</div>
            {result.chapter_analysis.map((ch) => {
              const riskStyle = RISK_COLORS[ch.dropoff_risk] ?? DEFAULT_RISK_STYLE;
              return (
                <div key={ch.chapter} className={`rounded border ${riskStyle.border} ${riskStyle.bg} p-2 space-y-1`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-[var(--color-text-primary)]">
                      第{ch.chapter}章 {ch.title}
                    </span>
                    <span className={`text-[10px] ${riskStyle.text}`}>
                      {RISK_LABELS[ch.dropoff_risk] ?? ch.dropoff_risk}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-[var(--color-text-muted)]">
                    <span>留存 {ch.retention_score}</span>
                    <span>钩子 {ch.hook_quality}</span>
                    <span>悬念 {ch.cliffhanger_strength}</span>
                  </div>
                  {ch.risk_factors.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {ch.risk_factors.map((f, i) => (
                        <span key={i} className="rounded bg-[var(--color-surface-1)]/50 px-1 py-0.5 text-[10px] text-[var(--color-text-muted)]">{f}</span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Critical dropoff points */}
          {result.critical_dropoff_points.length > 0 && (
            <div className="space-y-1">
              <div className="text-[10px] text-[var(--color-text-muted)]">关键流失点</div>
              {result.critical_dropoff_points.map((pt, i) => {
                const riskStyle = RISK_COLORS[pt.risk] ?? DEFAULT_RISK_STYLE;
                return (
                  <div key={i} className={`rounded border ${riskStyle.border} ${riskStyle.bg} p-1.5`}>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] ${riskStyle.text}`}>第{pt.chapter}章</span>
                      <span className="text-[10px] text-[var(--color-text-primary)]">{pt.reason}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Engagement peaks */}
          {result.engagement_peaks.length > 0 && (
            <div className="space-y-1">
              <div className="text-[10px] text-[var(--color-text-muted)]">参与高峰</div>
              {result.engagement_peaks.map((peak, i) => (
                <div key={i} className="rounded border border-green-500/20 bg-green-500/10 p-1.5">
                  <span className="text-[10px] text-green-400">第{peak.chapter}章</span>
                  <span className="ml-2 text-[10px] text-[var(--color-text-primary)]">{peak.reason}</span>
                </div>
              ))}
            </div>
          )}

          {/* Recommendations */}
          {result.recommendations.length > 0 && (
            <div className="space-y-1">
              <div className="text-[10px] text-[var(--color-text-muted)]">建议</div>
              {result.recommendations.map((r, i) => (
                <div key={i} className="text-xs text-[var(--color-text-primary)] rounded bg-[var(--color-surface-1)] p-1.5">
                  {r}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
