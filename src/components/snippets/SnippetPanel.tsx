import { useState, useEffect, useMemo } from "react";
import { useProjectStore } from "@/stores/projectStore";
import { useSnippetStore } from "@/stores/snippetStore";
import { useEditorStore } from "@/stores/editorStore";
import { SnippetForm } from "./SnippetForm";
import type { SnippetTemplate, SnippetCategory } from "@/types/project";

const CATEGORY_GROUPS: Array<{ key: SnippetCategory | "all"; label: string }> = [
  { key: "all", label: "全部" },
  { key: "fight", label: "打斗" },
  { key: "environment", label: "环境" },
  { key: "emotion", label: "心理" },
  { key: "dialogue", label: "对话" },
  { key: "transition", label: "过渡" },
  { key: "custom", label: "自定义" },
];

export function SnippetPanel() {
  const currentProject = useProjectStore((s) => s.currentProject);
  const items = useSnippetStore((s) => s.items);
  const loading = useSnippetStore((s) => s.loading);
  const searchQuery = useSnippetStore((s) => s.searchQuery);
  const selectedCategory = useSnippetStore((s) => s.selectedCategory);
  const previewItem = useSnippetStore((s) => s.previewItem);
  const isFormOpen = useSnippetStore((s) => s.isFormOpen);
  const editingItem = useSnippetStore((s) => s.editingItem);
  const fetchSnippets = useSnippetStore((s) => s.fetchSnippets);
  const setSelectedCategory = useSnippetStore((s) => s.setSelectedCategory);
  const setSearchQuery = useSnippetStore((s) => s.setSearchQuery);
  const setPreviewItem = useSnippetStore((s) => s.setPreviewItem);
  const openForm = useSnippetStore((s) => s.openForm);
  const removeSnippet = useSnippetStore((s) => s.removeSnippet);
  const editorInstance = useEditorStore((s) => s.editorInstance);

  useEffect(() => {
    if (currentProject) {
      fetchSnippets(currentProject.id);
    }
  }, [currentProject, fetchSnippets]);

  const filteredItems = useMemo(() => {
    let result = items;
    if (selectedCategory !== "all") {
      result = result.filter((item) => item.category === selectedCategory);
    }
    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      result = result.filter(
        (item) =>
          item.name.toLowerCase().includes(query) ||
          item.content.toLowerCase().includes(query),
      );
    }
    return result;
  }, [items, selectedCategory, searchQuery]);

  const groupedItems = useMemo(() => {
    const groups: Record<string, SnippetTemplate[]> = {};
    for (const item of filteredItems) {
      const cat = item.category;
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    }
    return groups;
  }, [filteredItems]);

  if (!currentProject) return null;

  const handleInsert = (item: SnippetTemplate) => {
    if (!editorInstance) return;
    editorInstance.chain().focus().insertContent(item.content).run();
  };

  const handleDelete = (item: SnippetTemplate) => {
    if (item.isBuiltin) return;
    removeSnippet(item.id);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Category tabs */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-white/5 px-2 py-1.5 scrollbar-none">
        {CATEGORY_GROUPS.map((g) => (
          <button
            key={g.key}
            onClick={() => setSelectedCategory(g.key)}
            className={`shrink-0 rounded px-2 py-1 text-xs transition-colors ${
              selectedCategory === g.key
                ? "bg-[var(--color-primary)]/20 text-[var(--color-primary)]"
                : "text-white/40 hover:bg-white/5"
            }`}
          >
            {g.label}
          </button>
        ))}
        <div className="flex-1" />
        <button
          onClick={() => openForm()}
          className="shrink-0 rounded bg-[var(--color-primary)] px-2 py-1 text-xs text-white hover:opacity-90"
        >
          + 新建
        </button>
      </div>

      {/* Search */}
      <div className="px-2 py-1.5 border-b border-white/5">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="搜索片段..."
          className="w-full rounded bg-white/5 px-2 py-1 text-xs text-white/80 placeholder:text-white/20 outline-none focus:bg-white/10"
        />
      </div>

      {/* Items list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {loading && items.length === 0 && (
          <div className="py-8 text-center text-xs text-white/20">加载中...</div>
        )}
        {!loading && filteredItems.length === 0 && (
          <div className="py-8 text-center text-xs text-white/20">
            {items.length === 0 ? "还没有片段模板" : "没有匹配的片段"}
          </div>
        )}
        {Object.entries(groupedItems).map(([category, categoryItems]) => (
          <SnippetCategoryGroup
            key={category}
            category={category}
            items={categoryItems}
            previewItem={previewItem}
            onSelect={setPreviewItem}
            onInsert={handleInsert}
            onDelete={handleDelete}
            onEdit={(item) => openForm(item)}
          />
        ))}
      </div>

      {/* Preview panel */}
      {previewItem && (
        <div className="border-t border-white/5 p-3 max-h-[40%] overflow-y-auto">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-white/80">{previewItem.name}</span>
            <div className="flex items-center gap-1">
              {!previewItem.isBuiltin && (
                <button
                  onClick={() => openForm(previewItem)}
                  className="rounded p-1 text-white/30 hover:bg-white/5 hover:text-white/60"
                  title="编辑"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2">
                    <path d="M8.5 1.5l2 2-7 7H1.5V8.5l7-7z" />
                  </svg>
                </button>
              )}
              <button
                onClick={() => handleInsert(previewItem)}
                className="rounded bg-[var(--color-primary)] px-2 py-1 text-xs text-white hover:opacity-90"
              >
                插入
              </button>
            </div>
          </div>
          <p className="text-xs text-white/50 whitespace-pre-wrap leading-relaxed">{previewItem.content}</p>
        </div>
      )}

      {/* Form modal */}
      {isFormOpen && (
        <SnippetForm
          item={editingItem}
          projectId={currentProject.id}
          onSubmit={editingItem
            ? (data) => useSnippetStore.getState().updateSnippet(editingItem.id, data)
            : (data) => useSnippetStore.getState().addSnippet(currentProject.id, data)
          }
          onCancel={() => useSnippetStore.getState().closeForm()}
        />
      )}
    </div>
  );
}

function SnippetCategoryGroup({
  category,
  items,
  previewItem,
  onSelect,
  onInsert,
  onDelete,
  onEdit,
}: {
  category: string;
  items: SnippetTemplate[];
  previewItem: SnippetTemplate | null;
  onSelect: (item: SnippetTemplate) => void;
  onInsert: (item: SnippetTemplate) => void;
  onDelete: (item: SnippetTemplate) => void;
  onEdit: (item: SnippetTemplate) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  const categoryLabel = CATEGORY_GROUPS.find((g) => g.key === category)?.label ?? category;

  return (
    <div>
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center gap-1.5 w-full text-[10px] text-white/30 uppercase tracking-wider mb-1"
      >
        <svg
          width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.5"
          className={`transition-transform ${collapsed ? "" : "rotate-90"}`}
        >
          <path d="M1 1l3 3 3-3" />
        </svg>
        {categoryLabel} ({items.length})
      </button>
      {!collapsed && (
        <div className="space-y-1">
          {items.map((item) => (
            <SnippetCard
              key={item.id}
              item={item}
              isActive={previewItem?.id === item.id}
              onSelect={() => onSelect(item)}
              onInsert={() => onInsert(item)}
              onDelete={() => onDelete(item)}
              onEdit={() => onEdit(item)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SnippetCard({
  item,
  isActive,
  onSelect,
  onInsert,
  onDelete,
  onEdit,
}: {
  item: SnippetTemplate;
  isActive: boolean;
  onSelect: () => void;
  onInsert: () => void;
  onDelete: () => void;
  onEdit: () => void;
}) {
  return (
    <div
      onClick={onSelect}
      className={`group rounded-lg border p-2 transition-colors cursor-pointer ${
        isActive
          ? "border-[var(--color-primary)]/30 bg-[var(--color-primary)]/10"
          : "border-white/5 bg-white/[0.02] hover:bg-white/[0.04]"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {item.isBuiltin && (
              <span className="text-[10px] text-[var(--color-primary)]/60 bg-[var(--color-primary)]/10 rounded px-1">
                内置
              </span>
            )}
            <span className="text-sm text-white/80 truncate">{item.name}</span>
          </div>
          <p className="mt-0.5 text-[10px] text-white/25 truncate">{item.content.slice(0, 40)}...</p>
        </div>
        <div className="shrink-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); onInsert(); }}
            className="rounded p-1 text-white/30 hover:bg-[var(--color-primary)]/10 hover:text-[var(--color-primary)]"
            title="插入到编辑器"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2">
              <path d="M6 1v10M1 6h10" />
            </svg>
          </button>
          {!item.isBuiltin && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); onEdit(); }}
                className="rounded p-1 text-white/30 hover:bg-white/5 hover:text-white/60"
                title="编辑"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2">
                  <path d="M8.5 1.5l2 2-7 7H1.5V8.5l7-7z" />
                </svg>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                className="rounded p-1 text-white/30 hover:bg-red-500/10 hover:text-red-400"
                title="删除"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2">
                  <path d="M2 2l8 8M10 2l-8 8" />
                </svg>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}