import { useEffect, useState } from "react";
import { templateService } from "@/services/templateService";
import { useProjectStore } from "@/stores/projectStore";
import type { OutlineTemplate, TemplateNode } from "@/types/project";

const GENRES = ["全部", "玄幻", "都市", "仙侠", "言情", "科幻", "悬疑"];

interface Props {
  onSelect: () => void;
}

export function TemplateGallery({ onSelect }: Props) {
  const templates = useProjectStore((_s) => []); // avoid unused import warning
  void templates;
  const [list, setList] = useState<OutlineTemplate[]>([]);
  const [activeGenre, setActiveGenre] = useState("全部");
  const [applying, setApplying] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState<OutlineTemplate | null>(null);
  const currentProject = useProjectStore((s) => s.currentProject);

  useEffect(() => {
    loadTemplates();
  }, []);

  async function loadTemplates() {
    const genre = activeGenre === "全部" ? undefined : activeGenre;
    const res = await templateService.list(genre);
    if (res.success && res.data) setList(res.data);
  }

  useEffect(() => {
    loadTemplates();
  }, [activeGenre]);

  async function handleApply(template: OutlineTemplate) {
    if (!currentProject) return;
    setApplying(template.id);
    const res = await templateService.apply(template.id, currentProject.id, "append");
    setApplying(null);
    setShowConfirm(null);
    if (res.success) {
      onSelect();
    }
  }

  function parseStructure(structure: string): TemplateNode[] {
    try { return JSON.parse(structure); } catch { return []; }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Genre filter */}
      <div className="flex gap-1 border-b border-white/5 px-3 py-2">
        {GENRES.map((g) => (
          <button
            key={g}
            onClick={() => setActiveGenre(g)}
            className={[
              "rounded-full px-2 py-0.5 text-xs transition-colors",
              activeGenre === g
                ? "bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
                : "text-white/30 hover:text-white/50",
            ].join(" ")}
          >
            {g}
          </button>
        ))}
      </div>

      {/* Template list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {list.map((tpl) => {
          const nodes = parseStructure(tpl.structure);
          const level0Count = nodes.filter((n) => n.level === 0).length;
          const totalCount = nodes.length;

          return (
            <div
              key={tpl.id}
              className="rounded-lg border border-white/5 bg-white/[0.02] p-3 hover:border-[var(--color-primary)]/20 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white/70">{tpl.name}</span>
                    <span className="rounded-full bg-[var(--color-primary)]/10 px-1.5 py-px text-[10px] text-[var(--color-primary)]">
                      {tpl.genre}
                    </span>
                    {tpl.isBuiltin ? (
                      <span className="text-[10px] text-white/20">内置</span>
                    ) : (
                      <span className="text-[10px] text-white/20">自定义</span>
                    )}
                  </div>
                  {tpl.description && (
                    <p className="mt-1 text-xs text-white/30">{tpl.description}</p>
                  )}
                  <div className="mt-1 text-[10px] text-white/15">
                    {level0Count} 卷 · {totalCount} 个节点
                  </div>

                  {/* Preview structure */}
                  <div className="mt-2 space-y-0.5">
                    {nodes.slice(0, 5).map((node, i) => (
                      <div
                        key={i}
                        className="truncate text-[10px] text-white/20"
                        style={{ paddingLeft: `${node.level * 12}px` }}
                      >
                        {node.level === 0 ? "▸ " : "· "}
                        {node.title}
                      </div>
                    ))}
                    {nodes.length > 5 && (
                      <div className="text-[10px] text-white/10">... 还有 {nodes.length - 5} 个节点</div>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-2 flex justify-end">
                <button
                  onClick={() => setShowConfirm(tpl)}
                  disabled={applying === tpl.id}
                  className="rounded bg-[var(--color-primary)]/10 px-2.5 py-1 text-xs text-[var(--color-primary)] hover:bg-[var(--color-primary)]/20 transition-colors disabled:opacity-50"
                >
                  {applying === tpl.id ? "应用中..." : "应用模板"}
                </button>
              </div>
            </div>
          );
        })}

        {list.length === 0 && (
          <div className="py-8 text-center text-xs text-white/20">
            暂无该类型模板
          </div>
        )}
      </div>

      {/* Confirm modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-xl border border-white/10 bg-[oklch(0.16_0_0)] p-4 shadow-2xl">
            <h3 className="text-sm font-medium text-white/80">应用模板：{showConfirm.name}</h3>
            <p className="mt-2 text-xs text-white/40">
              将把模板大纲追加到当前项目中。你可以之后自由编辑和删除这些节点。
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setShowConfirm(null)}
                className="rounded px-3 py-1.5 text-sm text-white/40 hover:bg-white/5"
              >
                取消
              </button>
              <button
                onClick={() => void handleApply(showConfirm)}
                className="rounded bg-[var(--color-primary)] px-3 py-1.5 text-sm text-white hover:opacity-90"
              >
                确认应用
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
