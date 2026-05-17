import { useState } from 'react';
import { translationService, type TranslationResult } from '@/services/translationService';

const LANGUAGES = [
  { value: 'en', label: '英文' },
  { value: 'ja', label: '日文' },
  { value: 'ko', label: '韩文' },
  { value: 'fr', label: '法文' },
  { value: 'de', label: '德文' },
  { value: 'es', label: '西班牙文' },
  { value: 'ru', label: '俄文' },
  { value: 'pt', label: '葡萄牙文' },
] as const;

const STYLES = [
  { value: 'literal' as const, label: '直译' },
  { value: 'free' as const, label: '意译' },
  { value: 'localized' as const, label: '本地化' },
];

interface TranslationPanelProps {
  projectId: string;
  selectedText: string;
  onApply: (text: string) => void;
}

export function TranslationPanel({ projectId, selectedText, onApply }: TranslationPanelProps) {
  const [targetLang, setTargetLang] = useState('en');
  const [style, setStyle] = useState<'literal' | 'free' | 'localized'>('free');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TranslationResult | null>(null);

  const handleTranslate = async () => {
    if (!selectedText.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await translationService.translate(projectId, {
        text: selectedText,
        targetLang,
        style,
      });
      if (res.success && res.data) {
        setResult(res.data);
      } else {
        setError(res.error || '翻译失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '请求失败');
    } finally {
      setLoading(false);
    }
  };

  const confidenceColor = (score: number) => {
    if (score >= 80) return 'text-green-400';
    if (score >= 50) return 'text-yellow-400';
    return 'text-red-400';
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

      {/* Target language */}
      <div>
        <div className="text-[10px] text-[var(--color-text-muted)] mb-1">目标语言</div>
        <div className="grid grid-cols-4 gap-1">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.value}
              onClick={() => setTargetLang(lang.value)}
              className={`rounded px-1 py-1 text-[9px] transition-colors ${
                targetLang === lang.value
                  ? 'bg-[var(--color-primary)]/20 text-[var(--color-primary)] border border-[var(--color-primary)]/30'
                  : 'border border-[var(--color-border)] text-[var(--color-text-muted)]'
              }`}
            >
              {lang.label}
            </button>
          ))}
        </div>
      </div>

      {/* Translation style */}
      <div>
        <div className="text-[10px] text-[var(--color-text-muted)] mb-1">翻译风格</div>
        <div className="flex gap-1">
          {STYLES.map((s) => (
            <button
              key={s.value}
              onClick={() => setStyle(s.value)}
              className={`flex-1 rounded px-2 py-1 text-[10px] transition-colors ${
                style === s.value
                  ? 'bg-[var(--color-primary)]/20 text-[var(--color-primary)] border border-[var(--color-primary)]/30'
                  : 'border border-[var(--color-border)] text-[var(--color-text-muted)]'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="rounded bg-red-500/10 p-2 text-[10px] text-red-400">{error}</div>}

      {/* Translate button */}
      <button
        onClick={handleTranslate}
        disabled={loading || !selectedText.trim()}
        className="w-full rounded bg-[var(--color-primary)] py-1.5 text-xs text-white hover:opacity-90 disabled:opacity-40"
      >
        {loading ? '翻译中...' : '翻译'}
      </button>

      {/* Result */}
      {result && (
        <div className="space-y-2">
          {/* Confidence */}
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[var(--color-text-muted)]">翻译结果</span>
            <span className={`text-[10px] font-medium ${confidenceColor(result.confidence)}`}>
              置信度 {result.confidence}%
            </span>
          </div>

          {/* Translated text */}
          <div className="rounded border border-[var(--color-border)] p-2 text-xs text-[var(--color-text-primary)] max-h-40 overflow-y-auto whitespace-pre-wrap">
            {result.translated}
          </div>

          {/* Notes */}
          {result.notes && (
            <div>
              <div className="text-[9px] text-[var(--color-text-muted)] mb-0.5">翻译说明</div>
              <div className="text-[10px] text-[var(--color-text-muted)] rounded bg-[var(--color-surface-1)] p-1.5">
                {result.notes}
              </div>
            </div>
          )}

          {/* Apply button */}
          <button
            onClick={() => onApply(result.translated)}
            className="w-full rounded bg-green-500/20 border border-green-500/30 py-1.5 text-xs text-green-400 hover:bg-green-500/30"
          >
            应用翻译
          </button>
        </div>
      )}
    </div>
  );
}
