import { useEffect, useState } from "react";
import { useEditorStore } from "@/stores/editorStore";
import { useProjectStore } from "@/stores/projectStore";
import { versionService } from "@/services/versionService";

const AUTO_HIDE_MS = 5 * 60 * 1000;

export function AiEditRollbackBanner() {
  const aiEditSnapshotVersionId = useEditorStore((s) => s.aiEditSnapshotVersionId);
  const aiEditSnapshotAt = useEditorStore((s) => s.aiEditSnapshotAt);
  const activeChapterId = useEditorStore((s) => s.activeChapterId);
  const currentProject = useProjectStore((s) => s.currentProject);
  const clearAiEditSnapshot = useEditorStore((s) => s.clearAiEditSnapshot);
  const updateContent = useEditorStore((s) => s.updateContent);
  const [isRollingBack, setIsRollingBack] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const visible = aiEditSnapshotVersionId !== null && activeChapterId !== null;

  // Auto-hide after 5 minutes
  useEffect(() => {
    if (!aiEditSnapshotAt) return;
    const remaining = AUTO_HIDE_MS - (Date.now() - aiEditSnapshotAt);
    if (remaining <= 0) {
      clearAiEditSnapshot();
      return;
    }
    const timer = setTimeout(clearAiEditSnapshot, remaining);
    return () => clearTimeout(timer);
  }, [aiEditSnapshotAt, clearAiEditSnapshot]);

  if (!visible || !currentProject || !activeChapterId) return null;

  async function handleRollback() {
    if (!currentProject || !activeChapterId || !aiEditSnapshotVersionId) return;
    setIsRollingBack(true);
    setError(null);
    try {
      const res = await versionService.rollback(currentProject.id, activeChapterId, aiEditSnapshotVersionId);
      if (res.success && res.data) {
        updateContent(res.data.content);
        clearAiEditSnapshot();
      } else {
        setError(res.error ?? "回滚失败");
      }
    } catch {
      setError("回滚请求失败");
    } finally {
      setIsRollingBack(false);
    }
  }

  return (
    <div className="flex items-center justify-between border-b border-amber-500/20 bg-amber-500/8 px-4 py-1.5">
      <div className="flex items-center gap-2">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-400">
          <path d="M1 4v6h6" />
          <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
        </svg>
        <span className="text-[var(--text-xs)] text-amber-300/80">
          AI 已编辑内容
        </span>
        {error && (
          <span className="text-[var(--text-xs)] text-red-400">{error}</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => void handleRollback()}
          disabled={isRollingBack}
          className="rounded px-2 py-0.5 text-[var(--text-xs)] font-medium text-amber-300 hover:bg-amber-500/10 disabled:opacity-50 transition-colors"
        >
          {isRollingBack ? "回滚中..." : "回滚到编辑前"}
        </button>
        <button
          onClick={clearAiEditSnapshot}
          className="rounded px-1.5 py-0.5 text-[var(--text-xs)] text-white/30 hover:text-white/60 hover:bg-white/5 transition-colors"
        >
          关闭
        </button>
      </div>
    </div>
  );
}
