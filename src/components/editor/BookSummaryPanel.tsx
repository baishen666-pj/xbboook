import { useState } from 'react';
import { bookSummaryService } from '@/services/bookSummaryService';

interface BookSummaryPanelProps {
  projectId: string;
}

const LEVEL_OPTIONS = [
  { value: 'brief', label: '简要' },
  { value: 'detailed', label: '详细' },
  { value: 'comprehensive', label: '全面' },
];

const FOCUS_OPTIONS = [
  { value: 'all', label: '全部' },
  { value: 'plot', label: '情节' },
  { value: 'character', label: '角色' },
  { value: 'worldview', label: '世界观' },
];

const THREAD_STATUS: Record<string, { bg: string; text: string; label: string }> = {
  open: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', label: '未解决' },
  resolved: { bg: 'bg-green-500/10', text: 'text-green-400', label: '已解决' },
};

export function BookSummaryPanel({ projectId }: BookSummaryPanelProps) {
  const [level, setLevel] = useState('detailed');
  const [focus, setFocus] = useState('all');
  const [expandedVolumes, setExpandedVolumes] = useState<Set<number>>(new Set());
  const [result, setResult] = useState<{
    book_summary: string;
    volume_summaries: { range: string; summary: string; key_events: string[] }[];
    character_arcs: { name: string; arc: string }[];
    worldview_changes: string[];
    plot_threads: { thread: string; status: string; chapters: number[] }[];
    timeline_gaps: string[];
    coherence_score: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    setIsLoading(true);
    setError('');
    try {
      const res = await bookSummaryService.generate(projectId, { level, focus });
      if (res.success && res.data) {
        setResult(res.data);
        setExpandedVolumes(new Set());
      } else {
        setError(res.error ?? '生成失败');
      }
    } catch {
      setError('请求失败');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleVolume = (index: number) => {
    setExpandedVolumes((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Controls */}
      <div className="border-b border-[var(--color-border)] p-2 space-y-2">
        <div className="text-sm font-medium text-[var(--color-text-primary)]">全书总结</div>
        <div className="flex items-center gap-2">
          <select
            value={level}
            onChange={(e) => setLevel(e.target.value)}
            className="flex-1 rounded border border-[var(--color-border)] bg-[var(--color-surface-0)] px-2 py-1 text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary)]/50"
          >
            {LEVEL_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
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
            onClick={handleGenerate}
            disabled={isLoading}
            className="rounded bg-[var(--color-primary)] px-3 py-1 text-xs text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {isLoading ? '生成中...' : '生成'}
          </button>
        </div>
        {error && <div className="text-[10px] text-red-400">{error}</div>}
      </div>

      {isLoading && (
        <div className="p-4 text-center text-xs text-[var(--color-text-muted)]">生成中...</div>
      )}

      {!isLoading && result && (
        <div className="flex-1 overflow-y-auto p-2 space-y-3">
          {/* Coherence score */}
          <div className="rounded border border-[var(--color-border)] bg-[var(--color-surface-1)] p-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-[var(--color-text-muted)]">一致性评分</span>
              <span className={`text-sm font-bold ${result.coherence_score >= 80 ? 'text-emerald-400' : result.coherence_score >= 60 ? 'text-amber-400' : 'text-red-400'}`}>
                {result.coherence_score}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-[var(--color-surface-1)]">
              <div
                className={`h-full rounded-full ${result.coherence_score >= 80 ? 'bg-emerald-400' : result.coherence_score >= 60 ? 'bg-amber-400' : 'bg-red-400'}`}
                style={{ width: `${result.coherence_score}%` }}
              />
            </div>
          </div>

          {/* Book summary */}
          <div className="rounded border border-[var(--color-border)] p-2 space-y-1">
            <div className="text-[10px] text-[var(--color-text-muted)]">全书摘要</div>
            <div className="text-xs text-[var(--color-text-primary)] whitespace-pre-wrap">{result.book_summary}</div>
          </div>

          {/* Volume summaries (collapsible) */}
          {result.volume_summaries.length > 0 && (
            <div className="space-y-1">
              <div className="text-[10px] text-[var(--color-text-muted)]">卷宗摘要</div>
              {result.volume_summaries.map((vol, idx) => {
                const isExpanded = expandedVolumes.has(idx);
                return (
                  <div key={idx} className="rounded border border-[var(--color-border)]">
                    <button
                      onClick={() => toggleVolume(idx)}
                      className="w-full flex items-center justify-between p-1.5 text-left"
                    >
                      <span className="text-[10px] font-medium text-[var(--color-text-primary)]">{vol.range}</span>
                      <span className="text-[10px] text-[var(--color-text-muted)]">{isExpanded ? '-' : '+'}</span>
                    </button>
                    {isExpanded && (
                      <div className="border-t border-[var(--color-border)] p-1.5 space-y-1">
                        <div className="text-xs text-[var(--color-text-primary)]">{vol.summary}</div>
                        {vol.key_events.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {vol.key_events.map((evt, i) => (
                              <span key={i} className="rounded bg-[var(--color-surface-1)] px-1.5 py-0.5 text-[10px] text-[var(--color-text-muted)]">{evt}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Character arcs */}
          {result.character_arcs.length > 0 && (
            <div className="space-y-1">
              <div className="text-[10px] text-[var(--color-text-muted)]">角色弧线</div>
              {result.character_arcs.map((ca, i) => (
                <div key={i} className="rounded border border-[var(--color-border)] p-1.5">
                  <span className="text-xs font-medium text-[var(--color-text-primary)]">{ca.name}</span>
                  <div className="text-[10px] text-[var(--color-text-muted)]">{ca.arc}</div>
                </div>
              ))}
            </div>
          )}

          {/* Plot threads */}
          {result.plot_threads.length > 0 && (
            <div className="space-y-1">
              <div className="text-[10px] text-[var(--color-text-muted)]">情节线索</div>
              {result.plot_threads.map((pt, i) => {
                const statusStyle = THREAD_STATUS[pt.status] ?? THREAD_STATUS.open;
                return (
                  <div key={i} className="flex items-center justify-between rounded border border-[var(--color-border)] p-1.5">
                    <span className="text-xs text-[var(--color-text-primary)]">{pt.thread}</span>
                    <div className="flex items-center gap-1">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${statusStyle?.bg ?? ''} ${statusStyle?.text ?? ''}`}>
                        {statusStyle?.label ?? pt.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Timeline gaps */}
          {result.timeline_gaps.length > 0 && (
            <div className="space-y-1">
              <div className="text-[10px] text-[var(--color-text-muted)]">时间线空缺</div>
              {result.timeline_gaps.map((gap, i) => (
                <div key={i} className="rounded bg-amber-500/10 p-1.5 text-[10px] text-amber-400">{gap}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
