import { useState } from 'react';
import { loreGeneratorService, LORE_TYPES, LORE_TYPE_LABELS, type LoreType } from '@/services/loreGeneratorService';

interface LoreGeneratorPanelProps {
  projectId: string;
}

export function LoreGeneratorPanel({ projectId }: LoreGeneratorPanelProps) {
  const [type, setType] = useState<LoreType>('character-cards');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await loreGeneratorService.generate(projectId, type);
      if (res.success && res.data) {
        setResult(res.data);
      } else {
        setError(res.error || '生成失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '请求失败');
    } finally {
      setLoading(false);
    }
  };

  const renderResult = () => {
    if (!result) return null;

    if (type === 'character-cards' && result.cards) {
      return (
        <div className="space-y-2">
          {result.cards.map((card: any, i: number) => (
            <div key={i} className="rounded border border-[var(--color-border)] p-2">
              <div className="text-xs font-medium text-[var(--color-primary)] mb-1">{card.name}{card.nickname ? ` (${card.nickname})` : ''}</div>
              <div className="grid grid-cols-2 gap-1 text-[10px]">
                {card.gender && <div className="text-[var(--color-text-muted)]">性别: <span className="text-[var(--color-text-secondary)]">{card.gender}</span></div>}
                {card.age && <div className="text-[var(--color-text-muted)]">年龄: <span className="text-[var(--color-text-secondary)]">{card.age}</span></div>}
                {card.personality && <div className="col-span-2 text-[var(--color-text-muted)]">性格: <span className="text-[var(--color-text-secondary)]">{card.personality}</span></div>}
                {card.appearance && <div className="col-span-2 text-[var(--color-text-muted)]">外貌: <span className="text-[var(--color-text-secondary)]">{card.appearance}</span></div>}
                {card.background && <div className="col-span-2 text-[var(--color-text-muted)]">背景: <span className="text-[var(--color-text-secondary)]">{card.background}</span></div>}
                {card.goals && <div className="col-span-2 text-[var(--color-text-muted)]">目标: <span className="text-[var(--color-text-secondary)]">{card.goals}</span></div>}
                {card.fears && <div className="col-span-2 text-[var(--color-text-muted)]">弱点: <span className="text-[var(--color-text-secondary)]">{card.fears}</span></div>}
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (type === 'relationship-map' && result.relationships) {
      return (
        <div className="space-y-1">
          {result.relationships.map((r: any, i: number) => (
            <div key={i} className="flex items-center gap-2 text-xs rounded border border-[var(--color-border)] p-1.5">
              <span className="text-[var(--color-primary)]">{r.from}</span>
              <span className="text-[var(--color-text-muted)]">↔</span>
              <span className="text-[var(--color-primary)]">{r.to}</span>
              <span className="rounded bg-[var(--color-primary)]/10 px-1.5 py-0.5 text-[10px] text-[var(--color-primary)]">{r.type}</span>
              <span className="flex-1 text-[var(--color-text-muted)] text-[10px] truncate">{r.description}</span>
            </div>
          ))}
        </div>
      );
    }

    if (type === 'full-bible') {
      return (
        <div className="space-y-2">
          {result.title && <div className="text-xs font-medium text-[var(--color-primary)]">{result.title}</div>}
          {result.world_rules && (
            <div>
              <div className="text-[10px] font-medium text-[var(--color-text-muted)] mb-0.5">世界规则</div>
              {result.world_rules.map((r: string, i: number) => <div key={i} className="text-[10px] text-[var(--color-text-secondary)] pl-2">• {r}</div>)}
            </div>
          )}
          {result.key_characters && (
            <div>
              <div className="text-[10px] font-medium text-[var(--color-text-muted)] mb-0.5">核心角色</div>
              {result.key_characters.map((c: any, i: number) => (
                <div key={i} className="text-[10px] text-[var(--color-text-secondary)] pl-2">
                  <span className="text-[var(--color-primary)]">{c.name}</span> ({c.role}): {c.arc}
                </div>
              ))}
            </div>
          )}
          {result.themes && (
            <div>
              <div className="text-[10px] font-medium text-[var(--color-text-muted)] mb-0.5">核心主题</div>
              {result.themes.map((t: string, i: number) => <div key={i} className="text-[10px] text-[var(--color-text-secondary)] pl-2">• {t}</div>)}
            </div>
          )}
        </div>
      );
    }

    // worldview-summary or generic fallback
    return (
      <div className="rounded border border-[var(--color-border)] p-2 text-xs text-[var(--color-text-secondary)] max-h-60 overflow-y-auto whitespace-pre-wrap">
        {JSON.stringify(result, null, 2)}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {/* Type selection */}
      <div className="grid grid-cols-2 gap-1">
        {LORE_TYPES.map((t) => (
          <button
            key={t}
            onClick={() => { setType(t); setResult(null); setError(null); }}
            className={`rounded px-2 py-1.5 text-[10px] transition-colors ${
              type === t
                ? 'bg-[var(--color-primary)]/20 text-[var(--color-primary)] border border-[var(--color-primary)]/30'
                : 'border border-[var(--color-border)] text-[var(--color-text-muted)]'
            }`}
          >
            {LORE_TYPE_LABELS[t]}
          </button>
        ))}
      </div>

      {error && <div className="rounded bg-red-500/10 p-2 text-xs text-red-400">{error}</div>}

      <button onClick={handleGenerate} disabled={loading}
        className="w-full rounded bg-[var(--color-primary)] py-1.5 text-xs text-white hover:opacity-90 disabled:opacity-40">
        {loading ? '生成中...' : `生成${LORE_TYPE_LABELS[type]}`}
      </button>

      {result && renderResult()}
    </div>
  );
}
