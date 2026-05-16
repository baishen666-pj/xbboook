import { useState, useEffect } from "react";
import { useProjectStore } from "@/stores/projectStore";
import { useForeshadowingStore } from "@/stores/foreshadowingStore";
import { ForeshadowingBadge, ForeshadowingImportanceBadge } from "./ForeshadowingBadge";
import { ForeshadowingForm } from "./ForeshadowingForm";
import { DeleteButton } from '@/components/ui/DeleteButton';
import type { Foreshadowing, ForeshadowingStatus } from "@/types/project";

const STATUS_GROUPS: Array<{ key: ForeshadowingStatus; label: string }> = [
  { key: "planted", label: "已埋" },
  { key: "harvested", label: "已收" },
  { key: "forgotten", label: "遗忘" },
];

function getChapterTitle(chapterId: string | null): string | null {
  if (!chapterId) return null;
  const chapters = useProjectStore.getState().chapters;
  const ch = chapters.find((c) => c.id === chapterId);
  return ch?.title ?? null;
}

export function ForeshadowingPanel() {
  const currentProject = useProjectStore((s) => s.currentProject);
  const items = useForeshadowingStore((s) => s.items);
  const loading = useForeshadowingStore((s) => s.loading);
  const fetchForeshadowing = useForeshadowingStore((s) => s.fetchForeshadowing);
  const removeForeshadowing = useForeshadowingStore((s) => s.removeForeshadowing);
  const updateForeshadowing = useForeshadowingStore((s) => s.updateForeshadowing);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<Foreshadowing | null>(null);
  const [activeGroup, setActiveGroup] = useState<ForeshadowingStatus | "all">("all");

  useEffect(() => {
    if (currentProject) {
      fetchForeshadowing(currentProject.id);
    }
  }, [currentProject, fetchForeshadowing]);

  if (!currentProject) return null;

  const filtered = activeGroup === "all"
    ? items
    : items.filter((f) => f.status === activeGroup);

  const handleStatusChange = (id: string, status: ForeshadowingStatus) => {
    updateForeshadowing(currentProject.id, id, { status });
  };

  const handleDelete = (id: string) => {
    removeForeshadowing(currentProject.id, id);
  };

  const handleEdit = (item: Foreshadowing) => {
    setEditingItem(item);
    setShowForm(true);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Status group tabs */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-[var(--color-border)] px-2 py-1.5 scrollbar-none">
        <button
          onClick={() => setActiveGroup("all")}
          className={`shrink-0 rounded px-2 py-1 text-xs transition-colors ${
            activeGroup === "all"
              ? "bg-[var(--color-primary)]/20 text-[var(--color-primary)]"
              : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)]"
          }`}
        >
          全部
        </button>
        {STATUS_GROUPS.map((g) => (
          <button
            key={g.key}
            onClick={() => setActiveGroup(g.key)}
            className={`shrink-0 rounded px-2 py-1 text-xs transition-colors ${
              activeGroup === g.key
                ? "bg-[var(--color-primary)]/20 text-[var(--color-primary)]"
                : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)]"
            }`}
          >
            {g.label}
            {items.filter((f) => f.status === g.key).length > 0 && (
              <span className="ml-1 text-[10px] text-[var(--color-text-muted)]">
                {items.filter((f) => f.status === g.key).length}
              </span>
            )}
          </button>
        ))}
        <div className="flex-1" />
        <button
          onClick={() => { setEditingItem(null); setShowForm(true); }}
          className="shrink-0 rounded bg-[var(--color-primary)] px-2 py-1 text-xs text-white hover:opacity-90"
        >
          + 新建
        </button>
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {loading && items.length === 0 && (
          <div className="py-8 text-center text-xs text-[var(--color-text-muted)]">加载中...</div>
        )}
        {!loading && filtered.length === 0 && (
          <div className="py-8 text-center text-xs text-[var(--color-text-muted)]">
            {items.length === 0 ? "还没有伏笔，点击新建添加" : "该分组下没有伏笔"}
          </div>
        )}
        {filtered.map((item) => (
          <ForeshadowingCard
            key={item.id}
            item={item}
            onEdit={() => handleEdit(item)}
            onDelete={() => handleDelete(item.id)}
            onStatusChange={(status) => handleStatusChange(item.id, status)}
          />
        ))}
      </div>

      {/* Form modal */}
      {(showForm || editingItem) && (
        <ForeshadowingForm
          item={editingItem}
          onSubmit={editingItem
            ? (data) => {
                updateForeshadowing(currentProject.id, editingItem.id, data);
                setShowForm(false);
                setEditingItem(null);
              }
            : (data) => {
                useForeshadowingStore.getState().addForeshadowing(currentProject.id, data);
                setShowForm(false);
              }}
          onCancel={() => { setShowForm(false); setEditingItem(null); }}
        />
      )}
    </div>
  );
}

function ForeshadowingCard({
  item,
  onEdit,
  onDelete,
  onStatusChange,
}: {
  item: Foreshadowing;
  onEdit: () => void;
  onDelete: () => void;
  onStatusChange: (status: ForeshadowingStatus) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const plantChapter = getChapterTitle(item.plantChapterId);
  const expectedChapter = getChapterTitle(item.expectedHarvestChapterId);
  const actualChapter = getChapterTitle(item.actualHarvestChapterId);

  return (
    <div className="group rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-2.5 transition-colors hover:bg-[var(--color-surface-3)]">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1 cursor-pointer" onClick={() => setExpanded(!expanded)}>
          <div className="flex items-center gap-2">
            <ForeshadowingBadge status={item.status} />
            <ForeshadowingImportanceBadge importance={item.importance} />
            <span className="text-sm font-medium text-[var(--color-text-primary)] truncate">{item.title}</span>
          </div>
          {!expanded && (
            <div className="mt-1 flex items-center gap-2 text-[10px] text-[var(--color-text-muted)]">
              {plantChapter && <span>埋设: {plantChapter}</span>}
              {expectedChapter && <span>预期回收: {expectedChapter}</span>}
            </div>
          )}
          {expanded && (
            <div className="mt-2 space-y-1.5">
              {item.description && (
                <p className="text-xs text-[var(--color-text-muted)] whitespace-pre-wrap leading-relaxed">{item.description}</p>
              )}
              <div className="space-y-1 text-[10px] text-[var(--color-text-muted)]">
                {plantChapter && <div>埋设章节: {plantChapter}</div>}
                {expectedChapter && <div>预期回收章节: {expectedChapter}</div>}
                {actualChapter && <div>实际回收章节: {actualChapter}</div>}
              </div>
              {/* Status change buttons */}
              {item.status === "planted" && (
                <div className="flex gap-1.5 pt-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); onStatusChange("harvested"); }}
                    className="rounded border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-[10px] text-blue-400 hover:bg-blue-500/20"
                  >
                    标记已收
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onStatusChange("forgotten"); }}
                    className="rounded border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-400 hover:bg-amber-500/20"
                  >
                    标记遗忘
                  </button>
                </div>
              )}
              {item.status === "forgotten" && (
                <div className="flex gap-1.5 pt-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); onStatusChange("harvested"); }}
                    className="rounded border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-[10px] text-blue-400 hover:bg-blue-500/20"
                  >
                    标记已收
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onStatusChange("planted"); }}
                    className="rounded border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-400 hover:bg-emerald-500/20"
                  >
                    重新埋设
                  </button>
                </div>
              )}
              {item.status === "harvested" && (
                <div className="flex gap-1.5 pt-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); onStatusChange("planted"); }}
                    className="rounded border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-400 hover:bg-emerald-500/20"
                  >
                    重新埋设
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="shrink-0 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onEdit}
            className="rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-secondary)]"
            title="编辑"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2">
              <path d="M8.5 1.5l2 2-7 7H1.5V8.5l7-7z" />
            </svg>
          </button>
          <DeleteButton onDelete={onDelete} />
        </div>
      </div>
    </div>
  );
}