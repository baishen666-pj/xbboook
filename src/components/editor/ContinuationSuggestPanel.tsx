import { useState } from 'react';
import { continuationSuggestService, type ContinuationSuggestion } from '@/services/continuationSuggestService';

interface ContinuationSuggestPanelProps {
  projectId: string;
  selectedText: string;
  onApply: (text: string) => void;
}

export function ContinuationSuggestPanel({ projectId, selectedText, onApply }: ContinuationSuggestPanelProps) {
  const [suggestions, setSuggestions] = useState<ContinuationSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSuggest = async () => {
    if (!selectedText) return;
    setLoading(true);
    setError(null);
    setSuggestions([]);

    try {
      const res = await continuationSuggestService.suggest(projectId, selectedText);
      if (res.success && res.data) {
        setSuggestions(res.data.suggestions);
      } else {
        setError(res.error || '生成失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '请求失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Selected text preview */}
      <div>
        <div className="text-[10px] text-[var(--color-text-muted)] mb-1">选中文本</div>
        <div className="rounded bg-[var(--color-surface-1)] p-2 text-[10px] text-[var(--color-text-secondary)] max-h-20 overflow-y-auto line-clamp-4">
          {selectedText.slice(0, 500)}{selectedText.length > 500 ? '...' : ''}
        </div>
      </div>

      {/* Generate button */}
      <button
        onClick={handleSuggest}
        disabled={loading || !selectedText}
        className="w-full rounded px-3 py-1.5 text-[10px] font-medium bg-[var(--color-primary)] text-white hover:opacity-90 disabled:opacity-40 transition-opacity"
      >
        {loading ? '生成中...' : '生成续写建议'}
      </button>

      {/* Error */}
      {error && (
        <div className="rounded bg-red-500/10 border border-red-500/20 px-2 py-1.5 text-[10px] text-red-400">
          {error}
        </div>
      )}

      {/* Suggestion cards */}
      {suggestions.length > 0 && (
        <div className="space-y-2">
          <div className="text-[10px] text-[var(--color-text-muted)]">建议 ({suggestions.length})</div>
          {suggestions.map((s, i) => (
            <div
              key={i}
              className="rounded border border-[var(--color-border)] bg-[var(--color-surface-1)] p-2 space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-medium text-[var(--color-primary)]">
                  {s.direction}
                </span>
                <span className="text-[9px] text-[var(--color-text-muted)]">
                  {Math.round(s.confidence * 100)}%
                </span>
              </div>
              <div className="text-[10px] text-[var(--color-text-secondary)] leading-relaxed">
                {s.content}
              </div>
              <button
                onClick={() => onApply(s.content)}
                className="rounded px-2 py-0.5 text-[9px] border border-[var(--color-primary)]/30 text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 transition-colors"
              >
                采用
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
