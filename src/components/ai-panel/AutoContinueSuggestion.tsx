import { useState } from "react";
import type { useAutoContinue } from "@/hooks/useAutoContinue";

interface Props {
  autoContinue: ReturnType<typeof useAutoContinue>;
  onInsert: (text: string) => void;
}

export function AutoContinueSuggestion({ autoContinue, onInsert }: Props) {
  const { suggestion, isGenerating, error, clearSuggestion, generate } = autoContinue;
  const [direction, setDirection] = useState<"forward" | "scene" | "dialogue">("forward");

  if (!suggestion && !isGenerating && !error) return null;

  return (
    <div className="border-t border-[var(--color-border)] bg-[var(--color-surface-1)]">
      <div className="flex items-center justify-between px-3 py-1.5">
        <span className="text-[var(--text-xs)] text-[var(--color-text-muted)]">
          AI 续写建议
        </span>
        <div className="flex gap-1">
          <button
            onClick={() => void generate("", "forward")}
            disabled={isGenerating}
            className={`rounded px-1.5 py-0.5 text-[10px] ${direction === "forward" ? "bg-[var(--color-primary)] text-white" : "bg-[var(--color-surface-hover)] text-[var(--color-text-muted)]"} hover:opacity-80 disabled:opacity-50`}
          >
            推进
          </button>
          <button
            onClick={() => { setDirection("scene"); void generate("", "scene"); }}
            disabled={isGenerating}
            className={`rounded px-1.5 py-0.5 text-[10px] ${direction === "scene" ? "bg-[var(--color-primary)] text-white" : "bg-[var(--color-surface-hover)] text-[var(--color-text-muted)]"} hover:opacity-80 disabled:opacity-50`}
          >
            场景
          </button>
          <button
            onClick={() => { setDirection("dialogue"); void generate("", "dialogue"); }}
            disabled={isGenerating}
            className={`rounded px-1.5 py-0.5 text-[10px] ${direction === "dialogue" ? "bg-[var(--color-primary)] text-white" : "bg-[var(--color-surface-hover)] text-[var(--color-text-muted)]"} hover:opacity-80 disabled:opacity-50`}
          >
            对话
          </button>
          <button
            onClick={clearSuggestion}
            className="rounded px-1.5 py-0.5 text-[10px] text-[var(--color-text-muted)] hover:text-red-400"
          >
            关闭
          </button>
        </div>
      </div>

      {isGenerating && (
        <div className="px-3 pb-2">
          <div className="animate-pulse text-[var(--text-xs)] text-[var(--color-text-muted)]">
            正在生成续写建议...
          </div>
        </div>
      )}

      {error && (
        <div className="px-3 pb-2 text-[var(--text-xs)] text-red-400">
          {error}
        </div>
      )}

      {suggestion && !isGenerating && (
        <div className="px-3 pb-2">
          <div className="rounded bg-[var(--color-surface-hover)] p-2 text-[var(--text-xs)] text-[var(--color-text-secondary)] max-h-40 overflow-y-auto whitespace-pre-wrap">
            {suggestion}
          </div>
          <div className="mt-1.5 flex gap-1 justify-end">
            <button
              onClick={() => onInsert(suggestion)}
              className="rounded px-2 py-1 text-[var(--text-xs)] bg-[var(--color-primary)] text-white hover:opacity-90"
            >
              插入编辑器
            </button>
            <button
              onClick={clearSuggestion}
              className="rounded px-2 py-1 text-[var(--text-xs)] bg-[var(--color-surface-hover)] hover:opacity-80"
            >
              忽略
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
