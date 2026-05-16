import { useState, useEffect } from "react";
import type { SnippetTemplate, SnippetCategory } from "@/types/project";

const CATEGORIES: Array<{ value: SnippetCategory; label: string }> = [
  { value: "fight", label: "打斗" },
  { value: "environment", label: "环境" },
  { value: "emotion", label: "心理" },
  { value: "dialogue", label: "对话" },
  { value: "transition", label: "过渡" },
  { value: "custom", label: "自定义" },
];

interface SnippetFormProps {
  item: SnippetTemplate | null;
  projectId: string;
  onSubmit: (data: { name: string; category?: string; content: string }) => Promise<void>;
  onCancel: () => void;
}

export function SnippetForm({ item, onSubmit, onCancel }: SnippetFormProps) {
  const isEditing = item !== null;
  const isReadonly = item?.isBuiltin === 1;

  const [name, setName] = useState(item?.name ?? "");
  const [category, setCategory] = useState<SnippetCategory>(item?.category ?? "custom");
  const [content, setContent] = useState(item?.content ?? "");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (item) {
      setName(item.name);
      setCategory(item.category);
      setContent(item.content);
    }
  }, [item]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !content.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit({ name: name.trim(), category, content: content.trim() });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="absolute inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-border)] p-4 space-y-3"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-[var(--color-text-primary)]">
            {isReadonly ? "查看模板" : isEditing ? "编辑模板" : "新建片段模板"}
          </h3>
          <button
            type="button"
            onClick={onCancel}
            className="rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-secondary)]"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M2 2l8 8M10 2l-8 8" />
            </svg>
          </button>
        </div>

        <div>
          <label className="block text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider mb-1">名称</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isReadonly}
            placeholder="模板名称"
            className="w-full rounded bg-[var(--color-surface-2)] px-2 py-1.5 text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] outline-none focus:bg-[var(--color-surface-3)] disabled:opacity-50"
          />
        </div>

        <div>
          <label className="block text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider mb-1">分类</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as SnippetCategory)}
            disabled={isReadonly}
            className="w-full rounded bg-[var(--color-surface-2)] px-2 py-1.5 text-xs text-[var(--color-text-primary)] outline-none focus:bg-[var(--color-surface-3)] disabled:opacity-50"
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider mb-1">内容</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            disabled={isReadonly}
            placeholder="片段内容..."
            rows={6}
            className="w-full rounded bg-[var(--color-surface-2)] px-2 py-1.5 text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] outline-none focus:bg-[var(--color-surface-3)] resize-y disabled:opacity-50"
          />
        </div>

        {!isReadonly && (
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onCancel}
              className="rounded px-3 py-1.5 text-xs text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)]"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={submitting || !name.trim() || !content.trim()}
              className="rounded bg-[var(--color-primary)] px-3 py-1.5 text-xs text-white hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? "保存中..." : isEditing ? "更新" : "创建"}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}