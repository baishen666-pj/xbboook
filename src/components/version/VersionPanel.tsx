import { useEffect, useState } from "react";
import { useVersionStore } from "@/stores/versionStore";
import { useEditorStore } from "@/stores/editorStore";
import { useProjectStore } from "@/stores/projectStore";
import { VersionList } from "./VersionList";
import { VersionPreview } from "./VersionPreview";
import { VersionDiff } from "./VersionDiff";

type Tab = "history" | "compare";

export function VersionPanel() {
  const activeChapterId = useEditorStore((s) => s.activeChapterId);
  const currentProject = useProjectStore((s) => s.currentProject);
  const loadVersions = useVersionStore((s) => s.loadVersions);
  const createSnapshot = useVersionStore((s) => s.createSnapshot);
  const versions = useVersionStore((s) => s.versions);
  const setCompareVersionId = useVersionStore((s) => s.setCompareVersionId);
  const clear = useVersionStore((s) => s.clear);
  const [tab, setTab] = useState<Tab>("history");
  const [label, setLabel] = useState("");

  useEffect(() => {
    if (currentProject && activeChapterId) {
      void loadVersions(currentProject.id, activeChapterId);
    }
    return () => { clear(); };
  }, [currentProject, activeChapterId, loadVersions, clear]);

  if (!activeChapterId) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-white/20">
        选择章节查看版本历史
      </div>
    );
  }

  async function handleSnapshot() {
    if (!currentProject || !activeChapterId) return;
    await createSnapshot(currentProject.id, activeChapterId, label || undefined);
    setLabel("");
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-white/5 px-3 py-2">
        <button
          onClick={() => setTab("history")}
          className={[
            "rounded px-2 py-1 text-xs transition-colors",
            tab === "history"
              ? "bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
              : "text-white/30 hover:text-white/50",
          ].join(" ")}
        >
          历史
        </button>
        <button
          onClick={() => setTab("compare")}
          className={[
            "rounded px-2 py-1 text-xs transition-colors",
            tab === "compare"
              ? "bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
              : "text-white/30 hover:text-white/50",
          ].join(" ")}
        >
          对比
        </button>
        <div className="flex-1" />
        <div className="flex items-center gap-1">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="版本备注..."
            className="w-24 rounded border border-white/5 bg-white/[0.02] px-1.5 py-1 text-[10px] text-white/50 placeholder:text-white/15 focus:outline-none focus:border-[var(--color-primary)]/30"
          />
          <button
            onClick={() => void handleSnapshot()}
            className="rounded bg-[var(--color-primary)]/10 px-2 py-1 text-[10px] text-[var(--color-primary)] hover:bg-[var(--color-primary)]/20 transition-colors"
          >
            保存快照
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Version list */}
        <div className="w-56 flex-shrink-0 border-r border-white/5 overflow-y-auto">
          {tab === "compare" && (
            <div className="border-b border-white/5 px-3 py-1.5 text-[10px] text-white/20">
              点击选择对比基准版本
              {versions.slice(0, 20).map((v) => (
                <button
                  key={v.id}
                  onClick={() => setCompareVersionId(v.id)}
                  className="ml-1 rounded bg-white/5 px-1 text-white/30 hover:text-white/50"
                >
                  v{v.versionNumber}
                </button>
              ))}
            </div>
          )}
          <VersionList />
        </div>

        {/* Right: Preview or Diff */}
        <div className="flex-1 overflow-hidden">
          {tab === "history" ? <VersionPreview /> : <VersionDiff />}
        </div>
      </div>
    </div>
  );
}
