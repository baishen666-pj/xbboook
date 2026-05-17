import { useState } from 'react';
import { aiPolishService, POLISH_STYLES, type PolishStyle } from '@/services/aiPolishService';
import type { PolishResult } from '@/services/aiPolishService';

interface AiPolishPanelProps {
  projectId: string;
  selectedText: string;
  onApply: (polished: string) => void;
}

export function AiPolishPanel({ projectId, selectedText, onApply }: AiPolishPanelProps) {
  const [style, setStyle] = useState<PolishStyle>('文学化');
  const [customInstruction, setCustomInstruction] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PolishResult | null>(null);

  const handlePolish = async () => {
    if (!selectedText) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await aiPolishService.polish(projectId, selectedText, style, customInstruction.trim() || undefined);
      if (res.success && res.data) {
        setResult(res.data);
      } else {
        setError(res.error || '润色失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '请求失败');
    } finally {
      setLoading(false);
    }
  };

  const styleIcons: Record<string, string> = {
    '文学化': '📚',
    '口语化': '💬',
    '精简': '✂️',
    '热血': '🔥',
    '唯美': '🌸',
    '幽默': '😄',
    '悬疑': '🔮',
    '严肃': '📜',
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

      {/* Style Selection */}
      <div>
        <div className="text-[10px] text-[var(--color-text-muted)] mb-1">润色风格</div>
        <div className="grid grid-cols-4 gap-1">
          {POLISH_STYLES.map((s) => (
            <button
              key={s}
              onClick={() => setStyle(s)}
              className={`rounded px-1.5 py-1 text-[10px] transition-colors ${
                style === s
                  ? 'bg-[var(--color-primary)]/20 text-[var(--color-primary)] border border-[var(--color-primary)]/30'
                  : 'border border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-primary)]/30'
              }`}
            >
              {styleIcons[s]} {s}
            </button>
          ))}
        </div>
      </div>

      {/* Custom instruction */}
      <div>
        <div className="text-[10px] text-[var(--color-text-muted)] mb-1">额外要求（可选）</div>
        <input
          type="text"
          value={customInstruction}
          onChange={(e) => setCustomInstruction(e.target.value)}
          placeholder="如：保持古风用词"
          className="w-full rounded border border-[var(--color-border)] bg-[var(--color-surface-1)] px-2 py-1.5 text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none"
        />
      </div>

      {error && (
        <div className="rounded bg-red-500/10 p-2 text-xs text-red-400">{error}</div>
      )}

      <button
        onClick={handlePolish}
        disabled={loading || !selectedText}
        className="w-full rounded bg-[var(--color-primary)] py-1.5 text-xs text-white hover:opacity-90 disabled:opacity-40"
      >
        {loading ? '润色中...' : `${styleIcons[style]} ${style}润色`}
      </button>

      {/* Result */}
      {result && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[var(--color-text-muted)]">润色结果</span>
            <span className="text-[10px] text-[var(--color-primary)]">风格匹配度 {result.style_score}%</span>
          </div>
          <div className="rounded border border-[var(--color-border)] p-2 text-xs text-[var(--color-text-primary)] max-h-40 overflow-y-auto whitespace-pre-wrap">
            {result.polished}
          </div>
          {result.changes.length > 0 && (
            <div className="space-y-0.5">
              <div className="text-[10px] text-[var(--color-text-muted)]">主要修改</div>
              {result.changes.map((c, i) => (
                <div key={i} className="text-[10px] text-[var(--color-text-secondary)] pl-2">• {c}</div>
              ))}
            </div>
          )}
          <button
            onClick={() => onApply(result.polished)}
            className="w-full rounded bg-green-500/20 border border-green-500/30 py-1.5 text-xs text-green-400 hover:bg-green-500/30"
          >
            应用润色结果
          </button>
        </div>
      )}
    </div>
  );
}
