import { useState } from "react";
import type { Worldview } from "@/types/project";

interface Props {
  worldview?: Worldview | null;
  categories: string[];
  onSubmit: (data: { category: string; title: string; content?: string }) => void;
  onCancel: () => void;
}

const DEFAULT_CATEGORIES = [
  "力量体系",
  "地理",
  "历史",
  "种族",
  "势力",
  "物品",
  "文化",
  "规则",
];

export function WorldviewForm({ worldview, categories, onSubmit, onCancel }: Props) {
  const [category, setCategory] = useState(worldview?.category ?? "");
  const [title, setTitle] = useState(worldview?.title ?? "");
  const [content, setContent] = useState(worldview?.content ?? "");
  const [customCategory, setCustomCategory] = useState(false);

  const allCategories = [...new Set([...DEFAULT_CATEGORIES, ...categories])];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalCategory = customCategory ? category : category;
    if (!finalCategory.trim() || !title.trim()) return;
    onSubmit({ category: finalCategory, title, content: content || undefined });
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md max-h-[85vh] overflow-y-auto rounded-xl border border-white/10 bg-[oklch(0.16_0_0)] p-4 shadow-2xl">
        <h3 className="mb-3 text-sm font-medium text-white/80">
          {worldview ? "编辑设定" : "新建设定"}
        </h3>

        <form onSubmit={handleSubmit} className="space-y-2.5">
          <div>
            <label className="block text-xs text-white/40 mb-1">分类</label>
            <div className="flex gap-2">
              <select
                value={customCategory ? "__custom__" : category}
                onChange={(e) => {
                  if (e.target.value === "__custom__") {
                    setCustomCategory(true);
                    setCategory("");
                  } else {
                    setCustomCategory(false);
                    setCategory(e.target.value);
                  }
                }}
                className="flex-1 rounded border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white/80 focus:outline-none"
              >
                <option value="">选择分类...</option>
                {allCategories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
                <option value="__custom__">自定义...</option>
              </select>
            </div>
            {customCategory && (
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="输入自定义分类名"
                className="mt-1.5 w-full rounded border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white/80 placeholder:text-white/15 focus:outline-none focus:border-[var(--color-primary)]/50"
              />
            )}
          </div>

          <div>
            <label className="block text-xs text-white/40 mb-1">标题</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="设定名称"
              className="w-full rounded border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white/80 placeholder:text-white/15 focus:outline-none focus:border-[var(--color-primary)]/50"
            />
          </div>

          <div>
            <label className="block text-xs text-white/40 mb-1">内容</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="详细描述这个世界观设定..."
              rows={6}
              className="w-full rounded border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white/80 placeholder:text-white/15 focus:outline-none focus:border-[var(--color-primary)]/50 resize-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="rounded px-3 py-1.5 text-sm text-white/40 hover:bg-white/5"
            >
              取消
            </button>
            <button
              type="submit"
              className="rounded bg-[var(--color-primary)] px-3 py-1.5 text-sm text-white hover:opacity-90"
            >
              {worldview ? "保存" : "创建"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
