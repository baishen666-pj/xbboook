import { useState } from 'react';
import { nameGeneratorService, type GeneratedName } from '@/services/nameGeneratorService';

type NameCategory = 'character' | 'location' | 'technique' | 'faction';

const CATEGORIES: { value: NameCategory; label: string }[] = [
  { value: 'character', label: '角色名' },
  { value: 'location', label: '地名' },
  { value: 'technique', label: '功法名' },
  { value: 'faction', label: '势力名' },
];

interface NameGeneratorPanelProps {
  projectId: string;
  onInsert?: (name: string) => void;
}

export function NameGeneratorPanel({ projectId, onInsert }: NameGeneratorPanelProps) {
  const [category, setCategory] = useState<NameCategory>('character');
  const [context, setContext] = useState('');
  const [gender, setGender] = useState('');
  const [race, setRace] = useState('');
  const [count, setCount] = useState(5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [names, setNames] = useState<GeneratedName[]>([]);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const handleGenerate = async () => {
    if (!context.trim()) return;
    setLoading(true);
    setError(null);
    setNames([]);

    try {
      const res = await nameGeneratorService.generate(projectId, {
        category,
        context: context.trim(),
        count,
        gender: gender || undefined,
        race: race || undefined,
      });
      if (res.success && res.data) {
        setNames(res.data.names);
      } else {
        setError(res.error || '生成失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '请求失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (name: string, idx: number) => {
    navigator.clipboard.writeText(name);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 1500);
  };

  return (
    <div className="space-y-3">
      {/* Category selection */}
      <div className="grid grid-cols-2 gap-1">
        {CATEGORIES.map((c) => (
          <button
            key={c.value}
            onClick={() => { setCategory(c.value); setNames([]); setError(null); }}
            className={`rounded px-2 py-1.5 text-[10px] transition-colors ${
              category === c.value
                ? 'bg-[var(--color-primary)]/20 text-[var(--color-primary)] border border-[var(--color-primary)]/30'
                : 'border border-[var(--color-border)] text-[var(--color-text-muted)]'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Context input */}
      <div>
        <div className="text-[10px] text-[var(--color-text-muted)] mb-1">上下文描述</div>
        <textarea
          value={context}
          onChange={(e) => setContext(e.target.value)}
          placeholder="描述命名背景、角色特征、地理环境等..."
          rows={3}
          className="w-full rounded border border-[var(--color-border)] bg-[var(--color-surface-1)] px-2 py-1.5 text-[10px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]/50 resize-none"
        />
      </div>

      {/* Optional fields */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <div className="text-[9px] text-[var(--color-text-muted)] mb-0.5">性别 (可选)</div>
          <input
            value={gender}
            onChange={(e) => setGender(e.target.value)}
            placeholder="男/女"
            className="w-full rounded border border-[var(--color-border)] bg-[var(--color-surface-1)] px-2 py-1 text-[10px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]/50"
          />
        </div>
        <div>
          <div className="text-[9px] text-[var(--color-text-muted)] mb-0.5">种族 (可选)</div>
          <input
            value={race}
            onChange={(e) => setRace(e.target.value)}
            placeholder="人族/精灵..."
            className="w-full rounded border border-[var(--color-border)] bg-[var(--color-surface-1)] px-2 py-1 text-[10px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]/50"
          />
        </div>
      </div>

      {/* Count control */}
      <div className="flex items-center gap-2">
        <div className="text-[10px] text-[var(--color-text-muted)]">生成数量</div>
        <input
          type="range"
          min={1}
          max={10}
          value={count}
          onChange={(e) => setCount(Number(e.target.value))}
          className="flex-1"
        />
        <span className="text-[10px] text-[var(--color-primary)] w-4 text-right">{count}</span>
      </div>

      {error && <div className="rounded bg-red-500/10 p-2 text-[10px] text-red-400">{error}</div>}

      {/* Generate button */}
      <button
        onClick={handleGenerate}
        disabled={loading || !context.trim()}
        className="w-full rounded bg-[var(--color-primary)] py-1.5 text-xs text-white hover:opacity-90 disabled:opacity-40"
      >
        {loading ? '生成中...' : `生成${CATEGORIES.find((c) => c.value === category)?.label}`}
      </button>

      {/* Results */}
      {names.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[10px] text-[var(--color-text-muted)]">生成结果</div>
          {names.map((n, i) => (
            <div key={i} className="rounded border border-[var(--color-border)] p-2 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[var(--color-primary)]">{n.name}</span>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleCopy(n.name, i)}
                    className="rounded px-1.5 py-0.5 text-[9px] text-[var(--color-text-muted)] border border-[var(--color-border)] hover:bg-[var(--color-surface-1)]"
                  >
                    {copiedIdx === i ? '已复制' : '复制'}
                  </button>
                  {onInsert && (
                    <button
                      onClick={() => onInsert(n.name)}
                      className="rounded px-1.5 py-0.5 text-[9px] text-[var(--color-primary)] bg-[var(--color-primary)]/10 hover:bg-[var(--color-primary)]/20"
                    >
                      插入
                    </button>
                  )}
                </div>
              </div>
              <div className="text-[10px] text-[var(--color-text-muted)]">{n.meaning}</div>
              <div className="flex items-center gap-1">
                <span className="rounded bg-[var(--color-primary)]/10 px-1.5 py-0.5 text-[9px] text-[var(--color-primary)]">{n.style}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
