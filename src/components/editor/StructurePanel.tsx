import { useState } from 'react';
import { storyArchitectureService } from '@/services/storyArchitectureService';

interface StructurePanelProps {
  projectId: string;
}

const STRUCTURE_OPTIONS = [
  { value: 'three-act', label: '三幕式' },
  { value: 'five-act', label: '五幕式' },
  { value: 'hero-journey', label: '英雄之旅' },
  { value: 'save-the-cat', label: '救猫咪' },
];

export function StructurePanel({ projectId }: StructurePanelProps) {
  const [structure, setStructure] = useState('three-act');
  const [result, setResult] = useState<{
    structure: { name: string; acts: { name: string; chapters: number[]; summary: string; key_events: string[]; pacing: string; completeness: number }[] };
    pacing_curve: { chapter: number; intensity: number }[];
    suggestions: string[];
    overall_score: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAnalyze = async () => {
    setIsLoading(true);
    setError('');
    try {
      const res = await storyArchitectureService.analyze(projectId, { structure });
      if (res.success && res.data) {
        setResult(res.data);
      } else {
        setError(res.error ?? '分析失败');
      }
    } catch {
      setError('请求失败');
    } finally {
      setIsLoading(false);
    }
  };

  const maxIntensity = result
    ? Math.max(...result.pacing_curve.map((p) => p.intensity), 1)
    : 1;

  return (
    <div className="flex flex-col h-full">
      {/* Controls */}
      <div className="border-b border-[var(--color-border)] p-2 space-y-2">
        <div className="text-sm font-medium text-[var(--color-text-primary)]">故事架构分析</div>
        <div className="flex items-center gap-2">
          <select
            value={structure}
            onChange={(e) => setStructure(e.target.value)}
            className="flex-1 rounded border border-[var(--color-border)] bg-[var(--color-surface-0)] px-2 py-1 text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary)]/50"
          >
            {STRUCTURE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <button
            onClick={handleAnalyze}
            disabled={isLoading}
            className="rounded bg-[var(--color-primary)] px-3 py-1 text-xs text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {isLoading ? '分析中...' : '分析'}
          </button>
        </div>
        {error && <div className="text-[10px] text-red-400">{error}</div>}
      </div>

      {isLoading && (
        <div className="p-4 text-center text-xs text-[var(--color-text-muted)]">分析中...</div>
      )}

      {!isLoading && result && (
        <div className="flex-1 overflow-y-auto p-2 space-y-3">
          {/* Overall score */}
          <div className="rounded border border-[var(--color-border)] bg-[var(--color-surface-1)] p-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-[var(--color-text-muted)]">综合评分</span>
              <span className={`text-sm font-bold ${result.overall_score >= 80 ? 'text-emerald-400' : result.overall_score >= 60 ? 'text-amber-400' : 'text-red-400'}`}>
                {result.overall_score}
              </span>
            </div>
            <div className="text-[10px] text-[var(--color-text-muted)] mt-1">架构: {result.structure.name}</div>
          </div>

          {/* Acts */}
          <div className="space-y-2">
            {result.structure.acts.map((act, idx) => (
              <div key={idx} className="rounded border border-[var(--color-border)] p-2 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-[var(--color-text-primary)]">{act.name}</span>
                  <span className="text-[10px] text-[var(--color-text-muted)]">
                    第{act.chapters[0]}-{act.chapters[act.chapters.length - 1]}章
                  </span>
                </div>
                <div className="text-[10px] text-[var(--color-text-muted)]">{act.summary}</div>
                {/* Completeness bar */}
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-[var(--color-text-muted)]">完成度</span>
                  <div className="flex-1 h-1.5 rounded-full bg-[var(--color-surface-1)]">
                    <div
                      className={`h-full rounded-full ${act.completeness >= 80 ? 'bg-emerald-400' : act.completeness >= 50 ? 'bg-amber-400' : 'bg-red-400'}`}
                      style={{ width: `${act.completeness}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-[var(--color-text-muted)]">{act.completeness}%</span>
                </div>
                {act.key_events.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {act.key_events.map((evt, i) => (
                      <span key={i} className="rounded bg-[var(--color-surface-1)] px-1.5 py-0.5 text-[10px] text-[var(--color-text-muted)]">
                        {evt}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Pacing curve */}
          {result.pacing_curve.length > 0 && (
            <div className="rounded border border-[var(--color-border)] p-2 space-y-1">
              <div className="text-xs font-medium text-[var(--color-text-primary)]">节奏曲线</div>
              <div className="flex items-end gap-0.5 h-12">
                {result.pacing_curve.map((point) => (
                  <div
                    key={point.chapter}
                    className="flex-1 rounded-t bg-[var(--color-primary)]/60"
                    style={{ height: `${(point.intensity / maxIntensity) * 100}%` }}
                    title={`第${point.chapter}章: ${point.intensity}`}
                  />
                ))}
              </div>
              <div className="flex justify-between text-[10px] text-[var(--color-text-muted)]">
                <span>第{result.pacing_curve[0]?.chapter}章</span>
                <span>第{result.pacing_curve[result.pacing_curve.length - 1]?.chapter}章</span>
              </div>
            </div>
          )}

          {/* Suggestions */}
          {result.suggestions.length > 0 && (
            <div className="space-y-1">
              <div className="text-[10px] text-[var(--color-text-muted)]">建议</div>
              {result.suggestions.map((s, i) => (
                <div key={i} className="text-xs text-[var(--color-text-primary)] rounded bg-[var(--color-surface-1)] p-1.5">
                  {s}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
