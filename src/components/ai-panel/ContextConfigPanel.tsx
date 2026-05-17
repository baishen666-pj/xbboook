import { useState, useEffect, useCallback } from "react";
import { useProjectStore } from "@/stores/projectStore";
import { contextConfigService, type ContextSourceInfo, type ContextInfo } from "@/services/contextConfigService";

export function ContextConfigPanel({ onClose }: { onClose?: () => void }) {
  const currentProject = useProjectStore((s) => s.currentProject);
  const [info, setInfo] = useState<ContextInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [disabledLabels, setDisabledLabels] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    if (!currentProject?.id) return;
    setLoading(true);
    try {
      const res = await contextConfigService.getContextInfo(
        currentProject.id,
        [...disabledLabels]
      );
      if (res.success && res.data) {
        setInfo(res.data);
      }
    } catch {
      /* ignore */
    }
    setLoading(false);
  }, [currentProject?.id, disabledLabels]);

  useEffect(() => {
    void load();
  }, [load]);

  function toggleSource(label: string) {
    setDisabledLabels((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  if (!info) {
    return (
      <div className="p-4 text-[var(--text-sm)] text-[var(--color-text-muted)]">
        {loading ? "加载中..." : "无法加载上下文信息"}
      </div>
    );
  }

  const budgetPct = Math.min(100, info.budgetPercentage);
  const budgetColor = budgetPct > 90
    ? "bg-[var(--color-error)]"
    : budgetPct > 70
      ? "bg-[var(--color-warning)]"
      : "bg-[var(--color-primary)]";

  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex items-center justify-between">
        <span className="text-[var(--text-sm)] font-medium text-[var(--color-text-primary)]">
          上下文管理
        </span>
        {onClose && (
          <button
            onClick={onClose}
            className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
            aria-label="关闭"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M3 3l8 8M11 3l-8 8" />
            </svg>
          </button>
        )}
      </div>

      {/* Token budget bar */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between text-[var(--text-xs)] text-[var(--color-text-secondary)]">
          <span>Token 预算</span>
          <span>{info.usedTokens.toLocaleString()} / {info.maxTokens.toLocaleString()}</span>
        </div>
        <div className="h-2 w-full rounded-full bg-[var(--color-surface-3)]">
          <div
            className={`h-full rounded-full transition-all ${budgetColor}`}
            style={{ width: `${budgetPct}%` }}
          />
        </div>
        <div className="text-[10px] text-[var(--color-text-muted)] text-right">
          {budgetPct}% 已使用
        </div>
      </div>

      {/* Source toggles */}
      <div className="flex flex-col gap-1">
        {info.sources.map((source) => (
          <SourceToggle
            key={source.label}
            source={source}
            onToggle={() => toggleSource(source.label)}
          />
        ))}
      </div>
    </div>
  );
}

function SourceToggle({ source, onToggle }: { source: ContextSourceInfo; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={[
        "flex items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors",
        source.enabled
          ? "hover:bg-[var(--color-surface-2)]"
          : "opacity-50 hover:bg-[var(--color-surface-2)]",
      ].join(" ")}
    >
      <span
        className={[
          "flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border transition-colors",
          source.enabled
            ? "border-[var(--color-primary)] bg-[var(--color-primary)]"
            : "border-[var(--color-border)]",
        ].join(" ")}
      >
        {source.enabled && (
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2">
            <path d="M2 6l3 3 5-5" />
          </svg>
        )}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-[var(--text-xs)] font-medium text-[var(--color-text-primary)] truncate">
          {source.label}
        </span>
        <span className="block text-[10px] text-[var(--color-text-muted)] truncate">
          {source.description}
        </span>
      </span>
      <span className="text-[10px] text-[var(--color-text-muted)] flex-shrink-0">
        ~{source.estimatedTokens}t
      </span>
    </button>
  );
}
