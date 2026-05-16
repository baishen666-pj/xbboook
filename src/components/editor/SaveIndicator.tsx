import { useState, useEffect } from "react";
import { useEditorStore } from "@/stores/editorStore";

const AUTO_SAVE_INTERVAL = 30;

export function SaveIndicator() {
  const isDirty = useEditorStore((s) => s.isDirty);
  const isSaving = useEditorStore((s) => s.isSaving);
  const lastSavedAt = useEditorStore((s) => s.lastSavedAt);
  const dirtyAt = useEditorStore((s) => s.dirtyAt);

  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!isDirty || !dirtyAt) {
      setElapsed(0);
      return;
    }

    setElapsed(Math.floor((Date.now() - dirtyAt) / 1000));

    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - dirtyAt!) / 1000));
    }, 1000);

    return () => clearInterval(id);
  }, [isDirty, dirtyAt]);

  if (isSaving) {
    return (
      <span className="flex items-center gap-1.5 text-[var(--text-xs)] text-[var(--color-text-muted)]">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--color-primary)] animate-[pulse-subtle_1.5s_ease-in-out_infinite]" />
        保存中...
      </span>
    );
  }

  if (isDirty) {
    const remaining = Math.max(0, AUTO_SAVE_INTERVAL - elapsed);
    return (
      <span className="flex items-center gap-1.5 text-[var(--text-xs)] text-[var(--color-warning)]">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--color-warning)] animate-[pulse-subtle_2s_ease-in-out_infinite]" />
        未保存 · {remaining}s 后自动保存
      </span>
    );
  }

  if (lastSavedAt) {
    return (
      <span className="flex items-center gap-1.5 text-[var(--text-xs)] text-[var(--color-text-muted)]">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--color-success)]" />
        已保存于 {lastSavedAt.toLocaleTimeString()}
      </span>
    );
  }

  return (
    <span className="flex items-center gap-1.5 text-[var(--text-xs)] text-[var(--color-text-muted)]">
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--color-success)]" />
      就绪
    </span>
  );
}
