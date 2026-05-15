import { useState } from "react";
import { useProjectStore } from "@/stores/projectStore";
import { worldviewService } from "@/services/worldviewService";
import { WorldviewCard } from "./WorldviewCard";
import { WorldviewForm } from "./WorldviewForm";
import type { Worldview } from "@/types/project";

export function WorldviewList() {
  const currentProject = useProjectStore((s) => s.currentProject);
  const worldviews = useProjectStore((s) => s.worldviews);
  const categories = useProjectStore((s) => s.worldviewCategories);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<Worldview | null>(null);

  if (!currentProject) return null;

  const filtered = activeCategory === "all"
    ? worldviews
    : worldviews.filter((w) => w.category === activeCategory);

  const handleCreate = async (data: { category: string; title: string; content?: string }) => {
    const res = await worldviewService.create(currentProject.id, data);
    if (res.success && res.data) {
      useProjectStore.setState((s) => {
        const newCategories = s.worldviewCategories.includes(data.category)
          ? s.worldviewCategories
          : [...s.worldviewCategories, data.category];
        return {
          worldviews: [...s.worldviews, res.data!],
          worldviewCategories: newCategories,
        };
      });
    }
    setShowForm(false);
  };

  const handleUpdate = async (id: string, data: Partial<Pick<Worldview, "category" | "title" | "content">>) => {
    const res = await worldviewService.update(currentProject.id, id, data);
    if (res.success && res.data) {
      useProjectStore.setState((s) => ({
        worldviews: s.worldviews.map((w) => w.id === id ? res.data! : w),
      }));
    }
    setEditingItem(null);
  };

  const handleDelete = async (id: string) => {
    const res = await worldviewService.remove(currentProject.id, id);
    if (res.success) {
      useProjectStore.setState((s) => ({
        worldviews: s.worldviews.filter((w) => w.id !== id),
      }));
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Category tabs */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-white/5 px-2 py-1.5 scrollbar-none">
        <button
          onClick={() => setActiveCategory("all")}
          className={`shrink-0 rounded px-2 py-1 text-xs transition-colors ${
            activeCategory === "all"
              ? "bg-[var(--color-primary)]/20 text-[var(--color-primary)]"
              : "text-white/40 hover:bg-white/5"
          }`}
        >
          全部
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`shrink-0 rounded px-2 py-1 text-xs transition-colors ${
              activeCategory === cat
                ? "bg-[var(--color-primary)]/20 text-[var(--color-primary)]"
                : "text-white/40 hover:bg-white/5"
            }`}
          >
            {cat}
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
        {filtered.length === 0 && (
          <div className="py-8 text-center text-xs text-white/20">
            {worldviews.length === 0 ? "还没有设定，点击新建添加" : "该分类下没有设定"}
          </div>
        )}
        {filtered.map((item) => (
          <WorldviewCard
            key={item.id}
            worldview={item}
            onEdit={() => { setEditingItem(item); setShowForm(true); }}
            onDelete={() => handleDelete(item.id)}
          />
        ))}
      </div>

      {/* Form modal */}
      {(showForm || editingItem) && (
        <WorldviewForm
          worldview={editingItem}
          categories={categories}
          onSubmit={editingItem
            ? (data) => handleUpdate(editingItem.id, data)
            : handleCreate}
          onCancel={() => { setShowForm(false); setEditingItem(null); }}
        />
      )}
    </div>
  );
}
