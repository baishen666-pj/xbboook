import { useState, useEffect, useCallback } from "react";
import { memoryService, type AiMemory, type MemoryStats } from "@/services/memoryService";

const CATEGORIES = [
  { value: "", label: "全部" },
  { value: "plot_event", label: "情节事件" },
  { value: "character_state", label: "角色状态" },
  { value: "setting_detail", label: "设定细节" },
  { value: "timeline", label: "时间线" },
  { value: "foreshadowing_hint", label: "伏笔暗示" },
  { value: "worldbuilding", label: "世界观" },
  { value: "other", label: "其他" },
] as const;

const IMPORTANCE_COLORS: Record<string, string> = {
  critical: "bg-red-500/20 text-red-400",
  high: "bg-orange-500/20 text-orange-400",
  normal: "bg-blue-500/20 text-blue-400",
  low: "bg-gray-500/20 text-gray-400",
};

const CATEGORY_ICONS: Record<string, string> = {
  plot_event: "📖",
  character_state: "👤",
  setting_detail: "⚙️",
  timeline: "⏰",
  foreshadowing_hint: "🔮",
  worldbuilding: "🌍",
  other: "📌",
};

interface Props {
  projectId: string;
}

export function MemoryPanel({ projectId }: Props) {
  const [memories, setMemories] = useState<AiMemory[]>([]);
  const [stats, setStats] = useState<MemoryStats | null>(null);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [extracting, setExtracting] = useState(false);
  const [reindexing, setReindexing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [memRes, statsRes] = await Promise.all([
      memoryService.list(projectId, filter ? { category: filter } : undefined),
      memoryService.stats(projectId),
    ]);
    if (memRes.success && memRes.data) setMemories(memRes.data);
    if (statsRes.success && statsRes.data) setStats(statsRes.data);
    setLoading(false);
  }, [projectId, filter]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleExtract = async () => {
    setExtracting(true);
    await memoryService.reindex(projectId);
    await loadData();
    setExtracting(false);
  };

  const handleReindex = async () => {
    setReindexing(true);
    await memoryService.reindex(projectId);
    await loadData();
    setReindexing(false);
  };

  const handleDelete = async (id: string) => {
    const res = await memoryService.delete(projectId, id);
    if (res.success) {
      setMemories(prev => prev.filter(m => m.id !== id));
    }
  };

  const handleClearAuto = async () => {
    await memoryService.clearAuto(projectId);
    await loadData();
  };

  const categoryLabel = (cat: string) => CATEGORIES.find(c => c.value === cat)?.label ?? cat;

  return (
    <div className="p-3 space-y-3 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <h3 className="text-[var(--text-sm)] font-medium text-[var(--color-text-primary)]">
          AI 记忆库
        </h3>
        <div className="flex gap-1">
          <button
            onClick={() => void handleReindex()}
            disabled={reindexing}
            className="rounded px-2 py-1 text-[var(--text-xs)] bg-[var(--color-surface-hover)] hover:opacity-80 disabled:opacity-50 transition-opacity"
            title="重建知识索引"
          >
            {reindexing ? "索引中..." : "重建索引"}
          </button>
          <button
            onClick={() => void handleExtract()}
            disabled={extracting}
            className="rounded px-2 py-1 text-[var(--text-xs)] bg-[var(--color-primary)] text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {extracting ? "提取中..." : "AI 提取"}
          </button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-3 gap-2 shrink-0">
          <div className="rounded bg-[var(--color-surface-hover)] p-2 text-center">
            <div className="text-[var(--text-lg)] font-bold text-[var(--color-primary)]">{stats.totalMemories}</div>
            <div className="text-[var(--text-xs)] text-[var(--color-text-muted)]">记忆条数</div>
          </div>
          <div className="rounded bg-[var(--color-surface-hover)] p-2 text-center">
            <div className="text-[var(--text-lg)] font-bold text-[var(--color-primary)]">{stats.totalChunks}</div>
            <div className="text-[var(--text-xs)] text-[var(--color-text-muted)]">知识分块</div>
          </div>
          <div className="rounded bg-[var(--color-surface-hover)] p-2 text-center">
            <div className="text-[var(--text-lg)] font-bold text-[var(--color-primary)]">
              {(stats.byImportance.critical || 0) + (stats.byImportance.high || 0)}
            </div>
            <div className="text-[var(--text-xs)] text-[var(--color-text-muted)]">高优先</div>
          </div>
        </div>
      )}

      {/* Filter chips */}
      <div className="flex flex-wrap gap-1 shrink-0">
        {CATEGORIES.map(cat => (
          <button
            key={cat.value}
            onClick={() => setFilter(cat.value)}
            className={`rounded-full px-2 py-0.5 text-[var(--text-xs)] transition-colors ${
              filter === cat.value
                ? "bg-[var(--color-primary)] text-white"
                : "bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)] hover:opacity-80"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Actions row */}
      <div className="flex gap-1 shrink-0">
        <button
          onClick={() => setShowCreate(true)}
          className="rounded px-2 py-1 text-[var(--text-xs)] bg-[var(--color-surface-hover)] hover:opacity-80 transition-opacity"
        >
          + 手动添加
        </button>
        {stats && (stats.byImportance.critical || 0) + (stats.byImportance.high || 0) + (stats.byImportance.normal || 0) > 0 && (
          <button
            onClick={() => void handleClearAuto()}
            className="rounded px-2 py-1 text-[var(--text-xs)] text-red-400 hover:bg-red-500/10 transition-colors"
          >
            清除自动提取
          </button>
        )}
      </div>

      {/* Memory list */}
      <div className="flex-1 overflow-y-auto space-y-1.5">
        {loading ? (
          <div className="py-6 text-center text-[var(--text-xs)] text-[var(--color-text-muted)]">加载中...</div>
        ) : memories.length === 0 ? (
          <div className="py-6 text-center text-[var(--text-xs)] text-[var(--color-text-muted)]">
            暂无记忆。点击"AI 提取"自动从章节中提取关键信息。
          </div>
        ) : (
          memories.map(mem => (
            <MemoryCard
              key={mem.id}
              memory={mem}
              projectId={projectId}
              isEditing={editingId === mem.id}
              onEdit={() => setEditingId(mem.id)}
              onCancelEdit={() => setEditingId(null)}
              onSave={async (data) => {
                await memoryService.update(projectId, mem.id, data);
                setEditingId(null);
                await loadData();
              }}
              onDelete={() => void handleDelete(mem.id)}
              categoryLabel={categoryLabel}
            />
          ))
        )}
      </div>

      {/* Create form */}
      {showCreate && (
        <CreateMemoryForm
          onSave={async (data) => {
            await memoryService.create(projectId, data);
            setShowCreate(false);
            await loadData();
          }}
          onCancel={() => setShowCreate(false)}
        />
      )}
    </div>
  );
}

function MemoryCard({
  memory,
  isEditing,
  onEdit,
  onCancelEdit,
  onSave,
  onDelete,
  categoryLabel,
}: {
  memory: AiMemory;
  projectId: string;
  isEditing: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSave: (data: { title: string; content: string; importance: string }) => Promise<void>;
  onDelete: () => void;
  categoryLabel: (cat: string) => string;
}) {
  const [title, setTitle] = useState(memory.title);
  const [content, setContent] = useState(memory.content);
  const [importance, setImportance] = useState(memory.importance);

  if (isEditing) {
    return (
      <div className="rounded border border-[var(--color-primary)]/30 bg-[var(--color-surface)] p-2 space-y-2">
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          className="w-full rounded bg-[var(--color-surface-hover)] px-2 py-1 text-[var(--text-xs)] text-[var(--color-text-primary)] outline-none"
          placeholder="标题"
        />
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          className="w-full rounded bg-[var(--color-surface-hover)] px-2 py-1 text-[var(--text-xs)] text-[var(--color-text-primary)] outline-none resize-none"
          rows={3}
          placeholder="内容"
        />
        <div className="flex gap-1 items-center">
          <select
            value={importance}
            onChange={e => setImportance(e.target.value)}
            className="rounded bg-[var(--color-surface-hover)] px-2 py-1 text-[var(--text-xs)] text-[var(--color-text-primary)] outline-none"
          >
            <option value="critical">关键</option>
            <option value="high">高</option>
            <option value="normal">普通</option>
            <option value="low">低</option>
          </select>
          <button
            onClick={() => void onSave({ title, content, importance })}
            className="rounded px-2 py-1 text-[var(--text-xs)] bg-[var(--color-primary)] text-white hover:opacity-90"
          >
            保存
          </button>
          <button
            onClick={onCancelEdit}
            className="rounded px-2 py-1 text-[var(--text-xs)] bg-[var(--color-surface-hover)] hover:opacity-80"
          >
            取消
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded bg-[var(--color-surface-hover)] p-2 group">
      <div className="flex items-start justify-between gap-1">
        <div className="flex items-center gap-1 min-w-0">
          <span className="text-[var(--text-xs)]">{CATEGORY_ICONS[memory.category] ?? "📌"}</span>
          <span className="text-[var(--text-xs)] font-medium text-[var(--color-text-primary)] truncate">
            {memory.title}
          </span>
          {memory.isAutoExtracted ? (
            <span className="rounded px-1 text-[9px] bg-purple-500/20 text-purple-400 shrink-0">AI</span>
          ) : null}
        </div>
        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={onEdit} className="text-[var(--text-xs)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">编辑</button>
          <button onClick={onDelete} className="text-[var(--text-xs)] text-red-400 hover:text-red-300">删除</button>
        </div>
      </div>
      <p className="mt-0.5 text-[var(--text-xs)] text-[var(--color-text-secondary)] line-clamp-2">
        {memory.content}
      </p>
      <div className="mt-1 flex gap-1">
        <span className={`rounded px-1 text-[9px] ${IMPORTANCE_COLORS[memory.importance] ?? IMPORTANCE_COLORS.normal}`}>
          {memory.importance}
        </span>
        <span className="rounded px-1 text-[9px] bg-[var(--color-surface)] text-[var(--color-text-muted)]">
          {categoryLabel(memory.category)}
        </span>
      </div>
    </div>
  );
}

function CreateMemoryForm({
  onSave,
  onCancel,
}: {
  onSave: (data: { category: string; title: string; content: string; importance: string }) => Promise<void>;
  onCancel: () => void;
}) {
  const [category, setCategory] = useState("other");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [importance, setImportance] = useState("normal");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim() || !content.trim()) return;
    setSaving(true);
    await onSave({ category, title, content, importance });
    setSaving(false);
  };

  return (
    <div className="rounded border border-[var(--color-primary)]/30 bg-[var(--color-surface)] p-2 space-y-2 shrink-0">
      <div className="flex gap-1">
        <select
          value={category}
          onChange={e => setCategory(e.target.value)}
          className="rounded bg-[var(--color-surface-hover)] px-2 py-1 text-[var(--text-xs)] text-[var(--color-text-primary)] outline-none"
        >
          {CATEGORIES.filter(c => c.value).map(c => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
        <select
          value={importance}
          onChange={e => setImportance(e.target.value)}
          className="rounded bg-[var(--color-surface-hover)] px-2 py-1 text-[var(--text-xs)] text-[var(--color-text-primary)] outline-none"
        >
          <option value="critical">关键</option>
          <option value="high">高</option>
          <option value="normal">普通</option>
          <option value="low">低</option>
        </select>
      </div>
      <input
        value={title}
        onChange={e => setTitle(e.target.value)}
        className="w-full rounded bg-[var(--color-surface-hover)] px-2 py-1 text-[var(--text-xs)] text-[var(--color-text-primary)] outline-none"
        placeholder="记忆标题"
      />
      <textarea
        value={content}
        onChange={e => setContent(e.target.value)}
        className="w-full rounded bg-[var(--color-surface-hover)] px-2 py-1 text-[var(--text-xs)] text-[var(--color-text-primary)] outline-none resize-none"
        rows={3}
        placeholder="记忆内容"
      />
      <div className="flex gap-1 justify-end">
        <button onClick={onCancel} className="rounded px-2 py-1 text-[var(--text-xs)] bg-[var(--color-surface-hover)] hover:opacity-80">取消</button>
        <button
          onClick={() => void handleSubmit()}
          disabled={saving || !title.trim() || !content.trim()}
          className="rounded px-2 py-1 text-[var(--text-xs)] bg-[var(--color-primary)] text-white hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "保存中..." : "添加"}
        </button>
      </div>
    </div>
  );
}
