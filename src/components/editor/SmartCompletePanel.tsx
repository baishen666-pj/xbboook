import { useState } from 'react';
import { smartCompleteService, DIRECTIONS, DIRECTION_LABELS, type CompleteDirection } from '@/services/smartCompleteService';

interface SmartCompletePanelProps {
  projectId: string;
  currentText: string;
  onApply: (completion: string) => void;
}

export function SmartCompletePanel({ projectId, currentText, onApply }: SmartCompletePanelProps) {
  const [direction, setDirection] = useState<CompleteDirection>('continue');
  const [maxWords, setMaxWords] = useState(300);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleComplete = async () => {
    if (!currentText || currentText.length < 20) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await smartCompleteService.complete(projectId, currentText, direction, maxWords);
      if (res.success && res.data) {
        setResult(res.data.completion);
      } else {
        setError(res.error || '补全失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '请求失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Direction selection */}
      <div>
        <div className="text-[10px] text-[var(--color-text-muted)] mb-1">补全方向</div>
        <div className="flex flex-wrap gap-1">
          {DIRECTIONS.map((d) => (
            <button
              key={d}
              onClick={() => setDirection(d)}
              className={`rounded px-2 py-1 text-[10px] transition-colors ${
                direction === d
                  ? 'bg-[var(--color-primary)]/20 text-[var(--color-primary)] border border-[var(--color-primary)]/30'
                  : 'border border-[var(--color-border)] text-[var(--color-text-muted)]'
              }`}
            >
              {DIRECTION_LABELS[d]}
            </button>
          ))}
        </div>
      </div>

      {/* Word count */}
      <div>
        <div className="text-[10px] text-[var(--color-text-muted)] mb-1">目标字数</div>
        <div className="flex gap-1">
          {[200, 300, 500].map((n) => (
            <button key={n} onClick={() => setMaxWords(n)}
              className={`rounded px-2 py-1 text-[10px] ${maxWords === n ? 'bg-[var(--color-primary)]/20 text-[var(--color-primary)]' : 'text-[var(--color-text-muted)]'}`}
            >{n}字</button>
          ))}
        </div>
      </div>

      {error && <div className="rounded bg-red-500/10 p-2 text-xs text-red-400">{error}</div>}

      <button onClick={handleComplete} disabled={loading || !currentText || currentText.length < 20}
        className="w-full rounded bg-[var(--color-primary)] py-1.5 text-xs text-white hover:opacity-90 disabled:opacity-40">
        {loading ? '补全中...' : `${DIRECTION_LABELS[direction]}`}
      </button>

      {result && (
        <div className="space-y-2">
          <div className="rounded border border-[var(--color-border)] p-2 text-xs text-[var(--color-text-primary)] max-h-40 overflow-y-auto whitespace-pre-wrap">
            {result}
          </div>
          <button onClick={() => onApply(result)}
            className="w-full rounded bg-green-500/20 border border-green-500/30 py-1.5 text-xs text-green-400 hover:bg-green-500/30">
            应用补全结果
          </button>
        </div>
      )}
    </div>
  );
}
