import { useState } from 'react';
import { readerFeedbackService, type ReaderFeedback } from '@/services/readerFeedbackService';

const READER_TYPES = [
  { value: 'casual', label: '休闲读者' },
  { value: 'hardcore', label: '硬核粉丝' },
  { value: 'critic', label: '评论家' },
  { value: 'cp_fan', label: 'CP粉' },
  { value: 'newbie', label: '萌新' },
] as const;

interface ReaderFeedbackPanelProps {
  projectId: string;
  selectedText: string;
}

export function ReaderFeedbackPanel({ projectId, selectedText }: ReaderFeedbackPanelProps) {
  const [selectedTypes, setSelectedTypes] = useState<string[]>(['casual', 'hardcore']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedbacks, setFeedbacks] = useState<ReaderFeedback[]>([]);

  const toggleType = (value: string) => {
    setSelectedTypes((prev) =>
      prev.includes(value)
        ? prev.filter((t) => t !== value)
        : [...prev, value]
    );
  };

  const handleSimulate = async () => {
    if (!selectedText.trim() || selectedTypes.length === 0) return;
    setLoading(true);
    setError(null);
    setFeedbacks([]);

    try {
      const res = await readerFeedbackService.simulate(projectId, {
        text: selectedText,
        readerTypes: selectedTypes,
      });
      if (res.success && res.data) {
        setFeedbacks(res.data.feedbacks);
      } else {
        setError(res.error || '模拟失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '请求失败');
    } finally {
      setLoading(false);
    }
  };

  const scoreColor = (score: number) => {
    if (score >= 80) return 'text-green-400 bg-green-500/10';
    if (score >= 60) return 'text-yellow-400 bg-yellow-500/10';
    if (score >= 40) return 'text-orange-400 bg-orange-500/10';
    return 'text-red-400 bg-red-500/10';
  };

  const readerTypeLabel = (type: string) => {
    const found = READER_TYPES.find((r) => r.value === type);
    return found ? found.label : type;
  };

  return (
    <div className="space-y-3">
      {/* Selected text preview */}
      <div>
        <div className="text-[10px] text-[var(--color-text-muted)] mb-1">选中文本</div>
        <div className="rounded bg-[var(--color-surface-1)] p-2 text-[10px] text-[var(--color-text-primary)] max-h-16 overflow-y-auto">
          {selectedText ? selectedText.slice(0, 500) : '未选中文本'}
          {selectedText.length > 500 ? '...' : ''}
        </div>
      </div>

      {/* Reader type multi-select */}
      <div>
        <div className="text-[10px] text-[var(--color-text-muted)] mb-1">读者类型</div>
        <div className="space-y-1">
          {READER_TYPES.map((rt) => (
            <label key={rt.value} className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedTypes.includes(rt.value)}
                onChange={() => toggleType(rt.value)}
                className="w-3 h-3 rounded accent-[var(--color-primary)]"
              />
              <span className="text-[10px] text-[var(--color-text-primary)]">{rt.label}</span>
            </label>
          ))}
        </div>
      </div>

      {error && <div className="rounded bg-red-500/10 p-2 text-[10px] text-red-400">{error}</div>}

      {/* Simulate button */}
      <button
        onClick={handleSimulate}
        disabled={loading || !selectedText.trim() || selectedTypes.length === 0}
        className="w-full rounded bg-[var(--color-primary)] py-1.5 text-xs text-white hover:opacity-90 disabled:opacity-40"
      >
        {loading ? '模拟中...' : '模拟反馈'}
      </button>

      {/* Feedback results */}
      {feedbacks.length > 0 && (
        <div className="space-y-2">
          <div className="text-[10px] text-[var(--color-text-muted)]">反馈结果</div>
          {feedbacks.map((fb, i) => (
            <div key={i} className="rounded border border-[var(--color-border)] p-2 space-y-1.5">
              {/* Header: reader type + score */}
              <div className="flex items-center justify-between">
                <span className="rounded bg-[var(--color-primary)]/10 px-1.5 py-0.5 text-[9px] text-[var(--color-primary)]">
                  {readerTypeLabel(fb.readerType)}
                </span>
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${scoreColor(fb.score)}`}>
                  {fb.score}
                </span>
              </div>

              {/* Reaction */}
              {fb.reaction && (
                <div className="text-[10px] text-[var(--color-text-primary)]">
                  "{fb.reaction}"
                </div>
              )}

              {/* Comment */}
              {fb.comment && (
                <div className="text-[10px] text-[var(--color-text-muted)]">
                  {fb.comment}
                </div>
              )}

              {/* Suggestions */}
              {fb.suggestions.length > 0 && (
                <div>
                  <div className="text-[9px] text-[var(--color-text-muted)] mb-0.5">建议</div>
                  <div className="space-y-0.5">
                    {fb.suggestions.map((s, si) => (
                      <div key={si} className="text-[9px] text-[var(--color-text-muted)] pl-2">
                        - {s}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
