import { useState, useCallback } from 'react';
import * as mcService from '@/services/modelComparisonService';

interface Props {}

export function ModelComparisonPanel(_props: Props) {
  const [providers, setProviders] = useState<Array<{ id: string; name: string; provider: string; model: string; isActive: boolean }>>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [prompt, setPrompt] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [results, setResults] = useState<mcService.ComparisonResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [winner, setWinner] = useState<string | null>(null);

  const loadProviders = useCallback(async () => {
    const res = await fetch('/api/ai/providers/config');
    const json = await res.json();
    setProviders(json.data || []);
  }, []);

  useState(() => { loadProviders(); });

  const toggleProvider = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id].slice(0, 3),
    );
  };

  const handleCompare = useCallback(async () => {
    if (selectedIds.length < 2 || !prompt.trim()) return;
    setLoading(true);
    setWinner(null);
    try {
      const data = await mcService.compareModels(prompt, selectedIds, systemPrompt || undefined);
      setResults(data);
    } catch { /* ignore */ }
    setLoading(false);
  }, [prompt, selectedIds, systemPrompt]);

  return (
    <div className="p-3 space-y-3 text-sm">
      <h4 className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide">多模型对比</h4>

      {/* Provider selection */}
      <div className="space-y-1">
        <span className="text-xs text-[var(--color-text-muted)]">选择模型 (2-3个)</span>
        <div className="flex flex-wrap gap-1">
          {providers.map(p => (
            <button
              key={p.id}
              onClick={() => toggleProvider(p.id)}
              className={`rounded px-2 py-0.5 text-xs ${selectedIds.includes(p.id) ? 'bg-[var(--color-primary)] text-white' : 'bg-white/5 text-[var(--color-text-muted)]'}`}
            >
              {p.name} ({p.model})
            </button>
          ))}
          {providers.length === 0 && (
            <span className="text-xs text-[var(--color-text-muted)]">请先在设置中配置多个提供商</span>
          )}
        </div>
      </div>

      {/* Prompt input */}
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="输入对比 Prompt..."
        className="w-full rounded bg-white/5 border border-white/10 px-2 py-1 text-xs text-[var(--color-text-primary)] placeholder-white/20"
        rows={3}
      />
      <input
        value={systemPrompt}
        onChange={(e) => setSystemPrompt(e.target.value)}
        placeholder="System prompt (可选)"
        className="w-full rounded bg-white/5 border border-white/10 px-2 py-1 text-xs text-[var(--color-text-primary)] placeholder-white/20"
      />

      <button
        onClick={handleCompare}
        disabled={loading || selectedIds.length < 2 || !prompt.trim()}
        className="rounded bg-[var(--color-primary)] px-3 py-1.5 text-xs text-white hover:opacity-90 disabled:opacity-40"
      >
        {loading ? '对比中...' : '开始对比'}
      </button>

      {/* Results */}
      {results.length > 0 && (
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${results.length}, 1fr)` }}>
          {results.map(r => (
            <div
              key={r.providerId}
              onClick={() => setWinner(r.providerId)}
              className={`rounded border p-2 cursor-pointer text-xs ${winner === r.providerId ? 'border-emerald-500 bg-emerald-500/5' : 'border-white/10'}`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-[var(--color-text-primary)]">{r.providerName}</span>
                <span className="text-[var(--color-text-muted)]">{r.model}</span>
              </div>
              {r.error ? (
                <p className="text-red-400">{r.error}</p>
              ) : (
                <>
                  <div className="text-[var(--color-text-muted)] mb-1">
                    {r.charCount}字 · {r.durationMs}ms
                  </div>
                  <p className="text-[var(--color-text-primary)] whitespace-pre-wrap max-h-40 overflow-y-auto">
                    {r.content.slice(0, 500)}{r.content.length > 500 ? '...' : ''}
                  </p>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {winner && (
        <div className="text-xs text-emerald-400">
          已选择: {results.find(r => r.providerId === winner)?.providerName} 为最佳
        </div>
      )}
    </div>
  );
}
