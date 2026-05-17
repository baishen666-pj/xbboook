import { useState, useEffect, useCallback } from 'react';
import { qualityService } from '@/services/qualityService';
import type { QualityReport, QualityIssue } from '@/services/qualityService';
import type { QualityReport as QualityReportType } from '@/services/qualityService';

interface QualityPanelProps {
  projectId: string;
  content: string;
  onIssueClick?: (offset: number, length: number) => void;
}

const SEVERITY_STYLES = {
  error: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20', label: '错误' },
  warning: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20', label: '警告' },
  info: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20', label: '建议' },
};

const TYPE_LABELS: Record<string, string> = {
  grammar: '语法',
  style: '风格',
  readability: '可读性',
  repetition: '重复',
  clarity: '清晰度',
};

function getScoreColor(score: number): string {
  if (score >= 90) return 'text-emerald-400';
  if (score >= 75) return 'text-green-400';
  if (score >= 60) return 'text-amber-400';
  return 'text-red-400';
}

function getScoreLabel(score: number): string {
  if (score >= 90) return '优秀';
  if (score >= 75) return '良好';
  if (score >= 60) return '一般';
  return '需改进';
}

export function QualityPanel({ projectId, content, onIssueClick }: QualityPanelProps) {
  const [report, setReport] = useState<QualityReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'error' | 'warning' | 'info'>('all');

  const analyze = useCallback(async () => {
    if (!content || content.trim().length < 10) {
      setReport(null);
      return;
    }

    setIsLoading(true);
    try {
      const res = await qualityService.analyze(projectId, content);
      if (res.success && res.data) {
        setReport(res.data);
      }
    } finally {
      setIsLoading(false);
    }
  }, [projectId, content]);

  // Debounced analysis
  useEffect(() => {
    const timer = setTimeout(analyze, 1000);
    return () => clearTimeout(timer);
  }, [analyze]);

  if (!content || content.trim().length < 10) {
    return (
      <div className="p-4 text-center text-xs text-[var(--color-text-muted)]">
        输入至少10个字符后开始分析
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-4 text-center text-xs text-[var(--color-text-muted)]">
        分析中...
      </div>
    );
  }

  if (!report) return null;

  const filtered = filter === 'all'
    ? report.issues
    : report.issues.filter((i) => i.severity === filter);

  return (
    <div className="flex flex-col h-full">
      {/* Score header */}
      <div className="border-b border-[var(--color-border)] p-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-lg font-bold text-[var(--color-text-primary)]">
              写作质量
            </div>
            <div className="text-[10px] text-[var(--color-text-muted)]">{report.summary}</div>
          </div>
          <div className="text-right">
            <div className={`text-2xl font-bold ${getScoreColor(report.overallScore)}`}>
              {report.overallScore}
            </div>
            <div className="text-[10px] text-[var(--color-text-muted)]">
              {getScoreLabel(report.overallScore)}
            </div>
          </div>
        </div>

        {/* Metrics grid */}
        <div className="mt-2 grid grid-cols-3 gap-2">
          <div className="rounded bg-[var(--color-surface-1)] p-1.5 text-center">
            <div className="text-xs font-medium text-[var(--color-text-primary)]">{report.avgSentenceLength}</div>
            <div className="text-[9px] text-[var(--color-text-muted)]">平均句长</div>
          </div>
          <div className="rounded bg-[var(--color-surface-1)] p-1.5 text-center">
            <div className="text-xs font-medium text-[var(--color-text-primary)]">{report.readabilityScore}</div>
            <div className="text-[9px] text-[var(--color-text-muted)]">可读性</div>
          </div>
          <div className="rounded bg-[var(--color-surface-1)] p-1.5 text-center">
            <div className="text-xs font-medium text-[var(--color-text-primary)]">{report.vocabularyRichness}%</div>
            <div className="text-[9px] text-[var(--color-text-muted)]">词汇丰富</div>
          </div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-[var(--color-border)] px-2 py-1.5 scrollbar-none">
        <button
          onClick={() => setFilter('all')}
          className={`shrink-0 rounded px-2 py-0.5 text-[10px] transition-colors ${
            filter === 'all' ? 'bg-[var(--color-primary)]/20 text-[var(--color-primary)]' : 'text-[var(--color-text-muted)]'
          }`}
        >
          全部 ({report.issues.length})
        </button>
        {(['error', 'warning', 'info'] as const).map((sev) => {
          const style = SEVERITY_STYLES[sev];
          const count = report.issues.filter((i) => i.severity === sev).length;
          return (
            <button
              key={sev}
              onClick={() => setFilter(sev)}
              className={`shrink-0 rounded px-2 py-0.5 text-[10px] transition-colors ${
                filter === sev ? `${style.bg} ${style.text}` : 'text-[var(--color-text-muted)]'
              }`}
            >
              {style.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Issues list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {filtered.length === 0 && (
          <div className="py-4 text-center text-xs text-[var(--color-text-muted)]">
            没有发现问题
          </div>
        )}
        {filtered.map((issue, idx) => (
          <IssueCard
            key={`${issue.offset}-${idx}`}
            issue={issue}
            onClick={() => onIssueClick?.(issue.offset, issue.length)}
          />
        ))}
      </div>
    </div>
  );
}

function IssueCard({ issue, onClick }: { issue: QualityIssue; onClick: () => void }) {
  const style = SEVERITY_STYLES[issue.severity];

  return (
    <div
      onClick={onClick}
      className={`cursor-pointer rounded border ${style.border} ${style.bg} p-2 transition-colors hover:opacity-80`}
    >
      <div className="flex items-center gap-1.5">
        <span className={`text-[10px] ${style.text}`}>{style.label}</span>
        <span className="text-[10px] text-[var(--color-text-muted)]">
          {TYPE_LABELS[issue.type] ?? issue.type}
        </span>
      </div>
      <div className="mt-0.5 text-xs text-[var(--color-text-primary)]">{issue.message}</div>
      {issue.suggestion && (
        <div className="mt-0.5 text-[10px] text-[var(--color-text-muted)]">{issue.suggestion}</div>
      )}
    </div>
  );
}
