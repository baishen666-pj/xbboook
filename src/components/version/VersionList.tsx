import { useVersionStore } from "@/stores/versionStore";
import { useEditorStore } from "@/stores/editorStore";
import { useProjectStore } from "@/stores/projectStore";
import type { ChapterVersion } from "@/types/project";

const TYPE_BADGES: Record<string, { label: string; color: string }> = {
  auto: { label: "自动", color: "bg-white/5 text-white/40" },
  manual: { label: "手动", color: "bg-[var(--color-primary)]/10 text-[var(--color-primary)]" },
  rollback: { label: "回滚", color: "bg-amber-500/10 text-amber-400" },
};

function isAiSnapshot(version: ChapterVersion): boolean {
  return !!version.label?.includes("AI编辑前");
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function VersionList() {
  const versions = useVersionStore((s) => s.versions);
  const isLoading = useVersionStore((s) => s.isLoading);
  const previewVersion = useVersionStore((s) => s.previewVersion);
  const setPreviewVersion = useVersionStore((s) => s.setPreviewVersion);
  const rollback = useVersionStore((s) => s.rollback);
  const deleteVersion = useVersionStore((s) => s.deleteVersion);
  const activeChapterId = useEditorStore((s) => s.activeChapterId);
  const currentProject = useProjectStore((s) => s.currentProject);

  if (isLoading) {
    return <div className="py-8 text-center text-xs text-white/20">加载中...</div>;
  }

  if (versions.length === 0) {
    return <div className="py-8 text-center text-xs text-white/20">暂无历史版本</div>;
  }

  async function handleRollback(version: ChapterVersion) {
    if (!currentProject || !activeChapterId) return;
    const confirmed = window.confirm(`确定回滚到版本 v${version.versionNumber}？当前内容将被替换。`);
    if (!confirmed) return;
    const content = await rollback(currentProject.id, activeChapterId, version.id);
    if (content !== null) {
      useEditorStore.getState().updateContent(content);
    }
  }

  async function handleDelete(version: ChapterVersion) {
    if (!currentProject || !activeChapterId) return;
    const confirmed = window.confirm(`确定删除版本 v${version.versionNumber}？`);
    if (!confirmed) return;
    await deleteVersion(currentProject.id, activeChapterId, version.id);
  }

  return (
    <div className="flex flex-col">
      {versions.map((version) => {
        const badge = TYPE_BADGES[version.snapshotType] ?? TYPE_BADGES["auto"]!;
        const isSelected = previewVersion?.id === version.id;
        const aiSnap = isAiSnapshot(version);

        return (
          <div
            key={version.id}
            className={[
              "group flex items-start gap-2 border-b border-white/5 px-3 py-2.5 cursor-pointer transition-colors",
              isSelected ? "bg-[var(--color-primary)]/5" : aiSnap ? "bg-amber-500/[0.03]" : "hover:bg-white/[0.02]",
            ].join(" ")}
            onClick={() => setPreviewVersion(version)}
          >
            <div className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-white/5 text-[10px] font-mono text-white/30">
              {version.versionNumber}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-white/60">{formatTime(version.createdAt)}</span>
                <span className={`rounded px-1 py-px text-[10px] ${badge.color}`}>
                  {badge.label}
                </span>
                {aiSnap && (
                  <span className="rounded px-1 py-px text-[10px] bg-amber-500/15 text-amber-400">
                    AI
                  </span>
                )}
              </div>
              {version.label && (
                <div className="mt-0.5 truncate text-[11px] text-white/40">{version.label}</div>
              )}
              <div className="mt-0.5 text-[10px] text-white/20">{version.wordCount} 字</div>
            </div>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={(e) => { e.stopPropagation(); void handleRollback(version); }}
                className="rounded px-1.5 py-0.5 text-[10px] text-amber-400/60 hover:bg-amber-500/10 hover:text-amber-400"
                title="回滚到此版本"
              >
                回滚
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); void handleDelete(version); }}
                className="rounded px-1.5 py-0.5 text-[10px] text-red-400/60 hover:bg-red-500/10 hover:text-red-400"
                title="删除此版本"
              >
                删除
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
