import { useState } from "react";
import type { Worldview } from "@/types/project";

interface Props {
  worldview: Worldview;
  onEdit: () => void;
  onDelete: () => void;
}

export function WorldviewCard({ worldview, onEdit, onDelete }: Props) {
  const [expanded, setExpanded] = useState(false);
  const hasContent = !!worldview.content;

  return (
    <div className="group rounded-lg border border-white/5 bg-white/[0.02] p-2.5 transition-colors hover:bg-white/[0.04]">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1 cursor-pointer" onClick={() => setExpanded(!expanded)}>
          <div className="flex items-center gap-2">
            <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-white/30">
              {worldview.category}
            </span>
            <span className="text-sm font-medium text-white/80 truncate">{worldview.title}</span>
          </div>
          {hasContent && !expanded && (
            <p className="mt-1 text-xs text-white/25 line-clamp-1">{worldview.content}</p>
          )}
          {hasContent && expanded && (
            <p className="mt-2 text-xs text-white/40 whitespace-pre-wrap leading-relaxed">{worldview.content}</p>
          )}
        </div>

        <div className="shrink-0 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onEdit}
            className="rounded p-1 text-white/30 hover:bg-white/5 hover:text-white/60"
            title="编辑"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2">
              <path d="M8.5 1.5l2 2-7 7H1.5V8.5l7-7z" />
            </svg>
          </button>
          <button
            onClick={onDelete}
            className="rounded p-1 text-white/30 hover:bg-red-500/10 hover:text-red-400"
            title="删除"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2">
              <path d="M2 2l8 8M10 2l-8 8" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
