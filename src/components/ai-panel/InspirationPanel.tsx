// @ts-nocheck
import { useState, useCallback } from "react";
import { apiClient } from "@/services/apiClient";

type InspoType = "name-generator" | "place-generator" | "plot-card" | "inspiration-collision";

const INSPO_TYPES: Array<{ id: InspoType; name: string; icon: string; placeholder: string }> = [
  { id: "name-generator", name: "角色名", icon: "🏷️", placeholder: "仙侠/都市/玄幻/武侠..." },
  { id: "place-generator", name: "地名/门派", icon: "🏔️", placeholder: "仙侠/玄幻/武侠/科幻..." },
  { id: "plot-card", name: "情节卡片", icon: "🃏", placeholder: "玄幻升级/都市爽文/悬疑推理..." },
  { id: "inspiration-collision", name: "灵感碰撞", icon: "💥", placeholder: "任意风格或留空..." },
];

export function InspirationPanel({ projectId }: { projectId: string }) {
  const [selectedType, setSelectedType] = useState<InspoType>("name-generator");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<unknown[]>([]);

  const handleGenerate = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await apiClient.post<{ content: string }>(`/projects/${projectId}/ai/stream`, {
        projectId,
        skillId: selectedType,
        question: input || undefined,
      });

      if (res.success && res.data) {
        setResult(res.data);
      } else {
        setError(res.error || "生成失败");
      }
    } catch {
      setError("生成失败，请重试");
    }
    setLoading(false);
  }, [projectId, selectedType, input]);

  const handleSave = useCallback((item: unknown) => {
    setSaved((prev) => [...prev, { ...item as object, savedAt: Date.now() }]);
  }, []);

  const handleRemove = useCallback((index: number) => {
    setSaved((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const currentType = INSPO_TYPES.find((t) => t.id === selectedType)!;

  return (
    <div className="flex flex-col h-full">
      {/* Type selector */}
      <div className="flex flex-wrap gap-1 p-2 border-b border-[var(--color-border)]">
        {INSPO_TYPES.map((t) => (
          <button
            key={t.id}
            onClick={() => { setSelectedType(t.id); setResult(null); setError(null); }}
            className={`rounded px-2 py-1 text-[var(--text-xs)] transition-colors ${
              selectedType === t.id
                ? "bg-[var(--color-primary)] text-white"
                : "bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)] hover:opacity-80"
            }`}
          >
            {t.icon} {t.name}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="flex gap-1 p-2 border-b border-[var(--color-border)]">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={currentType.placeholder}
          className="flex-1 rounded bg-[var(--color-surface-hover)] px-2 py-1 text-xs text-[var(--color-text-primary)] border border-[var(--color-border)] placeholder:text-[var(--color-text-muted)]"
          onKeyDown={(e) => { if (e.key === "Enter") void handleGenerate(); }}
        />
        <button
          onClick={() => void handleGenerate()}
          disabled={loading}
          className="rounded px-3 py-1 text-xs bg-[var(--color-primary)] text-white hover:opacity-90 disabled:opacity-50 transition-opacity whitespace-nowrap"
        >
          {loading ? "生成中..." : `${currentType.icon} 生成`}
        </button>
      </div>

      {/* Result */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {error && (
          <div className="rounded bg-red-500/10 px-2 py-1.5 text-xs text-red-400">{error}</div>
        )}

        {result && (
          <ResultView type={selectedType} data={result} onSave={handleSave} />
        )}

        {/* Saved items */}
        {saved.length > 0 && (
          <div className="mt-3 border-t border-[var(--color-border)] pt-2">
            <div className="text-xs text-[var(--color-text-muted)] mb-1">已收藏 ({saved.length})</div>
            {saved.map((item, i) => (
              <div key={i} className="flex items-start gap-1 rounded bg-[var(--color-surface-hover)] p-1.5 mb-1">
                <div className="flex-1 text-[10px] text-[var(--color-text-secondary)] whitespace-pre-wrap overflow-hidden max-h-12">
                  {typeof item === "object" ? JSON.stringify(item, null, 1).slice(0, 200) : String(item).slice(0, 200)}
                </div>
                <button onClick={() => handleRemove(i)} className="text-[10px] text-red-400/50 hover:text-red-400">×</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ResultView({ type, data, onSave }: { type: InspoType; data: unknown; onSave: (item: unknown) => void }) {
  let parsed: Record<string, unknown> | null = null;
  if (typeof data === "object" && data !== null) {
    parsed = data as Record<string, unknown>;
  }
  if (!parsed) return <pre className="text-xs text-[var(--color-text-secondary)] whitespace-pre-wrap">{JSON.stringify(data, null, 2)}</pre>;

  if (type === "name-generator" && parsed.names) {
    return (
      <div className="space-y-1">
        {(parsed.names as Array<Record<string, string>>).map((name, i) => (
          <div key={i} className="flex items-start gap-2 rounded bg-[var(--color-surface-hover)] p-1.5">
            <div className="flex-1">
              <div className="text-xs font-medium text-[var(--color-text-primary)]">{name.name as string}</div>
              <div className="text-[10px] text-[var(--color-text-secondary)]">{name.meaning as string}</div>
              <div className="text-[10px] text-[var(--color-text-muted)]">{name.style as string} · {name.gender as string} · {name.suitability as string}</div>
            </div>
            <button onClick={() => onSave(name)} className="text-[10px] text-[var(--color-primary)] hover:opacity-80">收藏</button>
          </div>
        ))}
      </div>
    );
  }

  if (type === "place-generator") {
    const places = (parsed.places as Array<Record<string, string>>) || [];
    const factions = (parsed.factions as Array<Record<string, string>>) || [];
    const techniques = (parsed.techniques as Array<Record<string, string>>) || [];
    return (
      <div className="space-y-2">
        {places.length > 0 && (
          <div>
            <div className="text-xs font-medium text-[var(--color-text-primary)]">地名</div>
            {places.map((p, i) => (
              <div key={i} className="flex items-start gap-1 rounded bg-[var(--color-surface-hover)] p-1 mt-0.5">
                <div className="flex-1 text-[10px]"><span className="text-[var(--color-text-primary)]">{p.name as string}</span> <span className="text-[var(--color-text-muted)]">{p.type as string}</span> <span className="text-[var(--color-text-secondary)]">{p.description as string}</span></div>
                <button onClick={() => onSave(p)} className="text-[10px] text-[var(--color-primary)]">收藏</button>
              </div>
            ))}
          </div>
        )}
        {factions.length > 0 && (
          <div>
            <div className="text-xs font-medium text-[var(--color-text-primary)]">门派/组织</div>
            {factions.map((f, i) => (
              <div key={i} className="flex items-start gap-1 rounded bg-[var(--color-surface-hover)] p-1 mt-0.5">
                <div className="flex-1 text-[10px]"><span className="text-[var(--color-text-primary)]">{f.name as string}</span> <span className="text-[var(--color-text-muted)]">{f.type as string}</span> <span className="text-[var(--color-text-secondary)]">{f.description as string}</span></div>
                <button onClick={() => onSave(f)} className="text-[10px] text-[var(--color-primary)]">收藏</button>
              </div>
            ))}
          </div>
        )}
        {techniques.length > 0 && (
          <div>
            <div className="text-xs font-medium text-[var(--color-text-primary)]">功法/技能</div>
            {techniques.map((t, i) => (
              <div key={i} className="flex items-start gap-1 rounded bg-[var(--color-surface-hover)] p-1 mt-0.5">
                <div className="flex-1 text-[10px]"><span className="text-[var(--color-text-primary)]">{t.name as string}</span> <span className="text-[var(--color-text-muted)]">{t.type as string} · {t.rank as string}级</span> <span className="text-[var(--color-text-secondary)]">{t.description as string}</span></div>
                <button onClick={() => onSave(t)} className="text-[10px] text-[var(--color-primary)]">收藏</button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (type === "plot-card" && parsed.cards) {
    return (
      <div className="space-y-1">
        {(parsed.cards as Array<Record<string, string>>).map((card, i) => (
          <div key={i} className="rounded bg-[var(--color-surface-hover)] p-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[var(--color-text-primary)]">{card.title as string}</span>
              <div className="flex gap-1">
                <span className="text-[9px] rounded px-1 bg-purple-500/20 text-purple-400">{card.type as string}</span>
                <span className="text-[9px] rounded px-1 bg-blue-500/20 text-blue-400">{card.difficulty as string}</span>
              </div>
            </div>
            <div className="text-[10px] text-[var(--color-text-secondary)] mt-0.5">{card.description as string}</div>
            <div className="text-[10px] text-[var(--color-text-muted)]">冲突: {card.conflict as string}</div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-[9px] text-green-400">读者钩: {card.reader_hook as string}</span>
              <button onClick={() => onSave(card)} className="text-[10px] text-[var(--color-primary)]">收藏</button>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (type === "inspiration-collision" && parsed.collisions) {
    return (
      <div className="space-y-1">
        {(parsed.collisions as Array<Record<string, string>>).map((c, i) => (
          <div key={i} className="rounded bg-[var(--color-surface-hover)] p-1.5">
            <div className="flex items-center gap-1 flex-wrap">
              {(JSON.parse(c.elements as string || "[]") as string[]).map((e, j) => (
                <span key={j} className="text-[9px] rounded px-1.5 py-0.5 bg-[var(--color-primary-subtle)] text-[var(--color-primary)]">{e}</span>
              ))}
              <span className="text-[9px] rounded px-1 bg-yellow-500/20 text-yellow-400">{c.potential as string}</span>
            </div>
            <div className="text-xs font-medium text-[var(--color-text-primary)] mt-1">{c.concept as string}</div>
            <div className="text-[10px] text-[var(--color-text-secondary)]">{c.synopsis as string}</div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-[9px] text-[var(--color-text-muted)]">反转: {c.twist as string}</span>
              <button onClick={() => onSave(c)} className="text-[10px] text-[var(--color-primary)]">收藏</button>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return <pre className="text-xs text-[var(--color-text-secondary)] whitespace-pre-wrap">{JSON.stringify(data, null, 2)}</pre>;
}
