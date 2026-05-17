import { useState, useEffect, useCallback } from "react";
import { projectTemplateService, type ProjectTemplate } from "@/services/projectTemplateService";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

const GENRE_TABS = ["全部", "玄幻", "都市", "言情", "仙侠", "科幻", "悬疑"];

interface TemplateStructure {
  characters?: unknown[];
  worldview?: unknown[];
  outlines?: unknown[];
  chapters?: unknown[];
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onProjectCreated: (projectId: string) => void;
}

export function TemplateProjectCreator({ isOpen, onClose, onProjectCreated }: Props) {
  const [templates, setTemplates] = useState<ProjectTemplate[]>([]);
  const [activeGenre, setActiveGenre] = useState("全部");
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState<string | null>(null);

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    const genre = activeGenre === "全部" ? undefined : activeGenre;
    const res = await projectTemplateService.list(genre);
    if (res.success && res.data) {
      setTemplates(res.data);
    }
    setLoading(false);
  }, [activeGenre]);

  useEffect(() => {
    if (isOpen) void loadTemplates();
  }, [isOpen, loadTemplates]);

  async function handleApply(templateId: string) {
    setApplying(templateId);
    const res = await projectTemplateService.apply(templateId);
    if (res.success && res.data) {
      onProjectCreated(res.data.id);
      onClose();
    }
    setApplying(null);
  }

  function getStructureInfo(template: ProjectTemplate): { chars: number; wvs: number; chs: number } {
    try {
      const s = JSON.parse(template.structure) as TemplateStructure;
      return {
        chars: s.characters?.length ?? 0,
        wvs: s.worldview?.length ?? 0,
        chs: s.chapters?.length ?? 0,
      };
    } catch {
      return { chars: 0, wvs: 0, chs: 0 };
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="从模板创建作品">
      <div className="flex flex-col gap-3 max-h-[70vh]">
        {/* Genre tabs */}
        <div className="flex gap-1 flex-wrap">
          {GENRE_TABS.map((g) => (
            <button
              key={g}
              onClick={() => setActiveGenre(g)}
              className={[
                "rounded-full px-2.5 py-1 text-[var(--text-xs)] transition-colors",
                activeGenre === g
                  ? "bg-[var(--color-primary)] text-white"
                  : "bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-3)]",
              ].join(" ")}
            >
              {g}
            </button>
          ))}
        </div>

        {/* Template list */}
        {loading ? (
          <div className="py-8 text-center text-[var(--text-sm)] text-[var(--color-text-muted)]">加载中...</div>
        ) : templates.length === 0 ? (
          <div className="py-8 text-center text-[var(--text-sm)] text-[var(--color-text-muted)]">暂无模板</div>
        ) : (
          <div className="flex flex-col gap-2 overflow-y-auto">
            {templates.map((t) => {
              const info = getStructureInfo(t);
              return (
                <div
                  key={t.id}
                  className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-[var(--text-sm)] font-medium text-[var(--color-text-primary)]">
                        {t.name}
                      </div>
                      {t.description && (
                        <div className="mt-1 text-[var(--text-xs)] text-[var(--color-text-muted)] line-clamp-2">
                          {t.description}
                        </div>
                      )}
                      <div className="mt-1.5 flex gap-2 text-[10px] text-[var(--color-text-muted)]">
                        {info.chars > 0 && <span>{info.chars} 角色</span>}
                        {info.wvs > 0 && <span>{info.wvs} 世界观</span>}
                        {info.chs > 0 && <span>{info.chs} 章节</span>}
                      </div>
                    </div>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => void handleApply(t.id)}
                      disabled={applying === t.id}
                    >
                      {applying === t.id ? "创建中..." : "使用"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
}
