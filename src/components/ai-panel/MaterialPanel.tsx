import { useState, useEffect, useCallback } from "react";
import { materialService, type Material } from "@/services/materialService";

const CATEGORIES = [
  { id: "character", name: "角色", icon: "👤" },
  { id: "worldbuilding", name: "世界观", icon: "🌍" },
  { id: "plot", name: "情节", icon: "📐" },
  { id: "dialogue", name: "对话", icon: "💬" },
  { id: "setting", name: "设定", icon: "⚙️" },
  { id: "other", name: "其他", icon: "📦" },
];

export function MaterialPanel({ projectId }: { projectId: string }) {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [category, setCategory] = useState<string | undefined>(undefined);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Material | null>(null);

  const load = useCallback(async () => {
    if (search.trim()) {
      const res = await materialService.search(projectId, search);
      if (res.success && res.data) setMaterials(res.data);
    } else {
      const res = await materialService.list(projectId, category);
      if (res.success && res.data) setMaterials(res.data);
    }
  }, [projectId, category, search]);

  useEffect(() => { void load(); }, [load]);

  const handleCreate = useCallback(async (data: { title: string; content: string; category: string; tags: string[] }) => {
    await materialService.create(projectId, data);
    setShowCreate(false);
    void load();
  }, [projectId, load]);

  const handleUpdate = useCallback(async (id: string, data: { title: string; content: string; category: string; tags: string[] }) => {
    await materialService.update(projectId, id, data);
    setEditing(null);
    void load();
  }, [projectId, load]);

  const handleDelete = useCallback(async (id: string) => {
    await materialService.remove(projectId, id);
    void load();
  }, [projectId, load]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-1 p-2 border-b border-[var(--color-border)]">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索素材..."
          className="flex-1 rounded bg-[var(--color-surface-hover)] px-2 py-1 text-xs text-[var(--color-text-primary)] border border-[var(--color-border)] placeholder:text-[var(--color-text-muted)]"
        />
        <button
          onClick={() => setShowCreate(true)}
          className="rounded px-2 py-1 text-xs bg-[var(--color-primary)] text-white hover:opacity-90 transition-opacity"
        >
          + 新建
        </button>
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap gap-0.5 p-2 border-b border-[var(--color-border)]">
        <button
          onClick={() => setCategory(undefined)}
          className={`rounded px-1.5 py-0.5 text-[10px] transition-colors ${!category ? "bg-[var(--color-primary)] text-white" : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]"}`}
        >
          全部
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            onClick={() => setCategory(c.id)}
            className={`rounded px-1.5 py-0.5 text-[10px] transition-colors ${category === c.id ? "bg-[var(--color-primary)] text-white" : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]"}`}
          >
            {c.icon} {c.name}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {materials.length === 0 && (
          <div className="text-center py-4 text-xs text-[var(--color-text-muted)]">
            暂无素材，点击"+ 新建"添加
          </div>
        )}
        {materials.map((m) => (
          <div key={m.id} className="rounded bg-[var(--color-surface-hover)] p-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <span className="text-[9px] rounded px-1 bg-purple-500/20 text-purple-400">
                  {CATEGORIES.find((c) => c.id === m.category)?.name || "其他"}
                </span>
                <span className="text-xs font-medium text-[var(--color-text-primary)]">{m.title}</span>
              </div>
              <div className="flex gap-1">
                <button onClick={() => setEditing(m)} className="text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">编辑</button>
                <button onClick={() => void handleDelete(m.id)} className="text-[10px] text-red-400/50 hover:text-red-400">删除</button>
              </div>
            </div>
            <div className="text-[10px] text-[var(--color-text-secondary)] mt-1 whitespace-pre-wrap line-clamp-3">{m.content}</div>
            {m.tags.length > 0 && (
              <div className="flex flex-wrap gap-0.5 mt-1">
                {m.tags.map((t, i) => (
                  <span key={i} className="text-[8px] rounded px-1 bg-[var(--color-primary-subtle)] text-[var(--color-primary)]">{t}</span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Create modal */}
      {showCreate && (
        <MaterialForm
          onSave={(data) => void handleCreate(data)}
          onCancel={() => setShowCreate(false)}
        />
      )}

      {/* Edit modal */}
      {editing && (
        <MaterialForm
          initial={editing}
          onSave={(data) => void handleUpdate(editing.id, data)}
          onCancel={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function MaterialForm({ initial, onSave, onCancel }: {
  initial?: Material;
  onSave: (data: { title: string; content: string; category: string; tags: string[] }) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(initial?.title || "");
  const [content, setContent] = useState(initial?.content || "");
  const [category, setCategory] = useState(initial?.category || "other");
  const [tagsInput, setTagsInput] = useState(initial?.tags?.join(", ") || "");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onCancel}>
      <div className="w-96 rounded-lg bg-[oklch(0.18_0_0)] border border-white/10 p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="text-sm font-medium text-white/80 mb-3">{initial ? "编辑素材" : "新建素材"}</div>
        <div className="space-y-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="标题"
            className="w-full rounded bg-white/5 border border-white/10 px-2 py-1.5 text-xs text-white/80 placeholder:text-white/20"
          />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="内容..."
            rows={5}
            className="w-full rounded bg-white/5 border border-white/10 px-2 py-1.5 text-xs text-white/80 placeholder:text-white/20 resize-none"
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded bg-white/5 border border-white/10 px-2 py-1.5 text-xs text-white/80"
          >
            {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
          </select>
          <input
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="标签（逗号分隔）"
            className="w-full rounded bg-white/5 border border-white/10 px-2 py-1.5 text-xs text-white/80 placeholder:text-white/20"
          />
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={onCancel} className="rounded px-3 py-1 text-xs text-white/40 hover:text-white/60">取消</button>
            <button
              onClick={() => onSave({ title, content, category, tags: tagsInput.split(",").map((t) => t.trim()).filter(Boolean) })}
              disabled={!title.trim() || !content.trim()}
              className="rounded px-3 py-1 text-xs bg-[var(--color-primary)] text-white hover:opacity-90 disabled:opacity-50"
            >
              {initial ? "保存" : "创建"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
