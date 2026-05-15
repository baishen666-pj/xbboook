import { useState, useEffect } from "react";
import { useProjectStore } from "@/stores/projectStore";
import { outlineService } from "@/services/outlineService";
import { TemplateGallery } from "@/components/template/TemplateGallery";
import type { Outline } from "@/types/project";

interface OutlineNode extends Outline {
  children: OutlineNode[];
}

function buildTree(items: Outline[]): OutlineNode[] {
  const map = new Map<string, OutlineNode>();
  const roots: OutlineNode[] = [];

  for (const item of items) {
    map.set(item.id, { ...item, children: [] });
  }

  for (const item of items) {
    const node = map.get(item.id)!;
    if (item.parentId && map.has(item.parentId)) {
      map.get(item.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

function OutlineItem({ node, onEdit, onDelete, onCreateChild }: {
  node: OutlineNode;
  onEdit: (node: OutlineNode) => void;
  onDelete: (id: string) => void;
  onCreateChild: (parentId: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const indent = node.level * 16;

  return (
    <div>
      <div
        className="group flex items-center gap-1.5 rounded px-2 py-1 text-sm text-white/70 hover:bg-white/5 cursor-pointer"
        style={{ paddingLeft: `${8 + indent}px` }}
      >
        {node.children.length > 0 ? (
          <button
            onClick={() => setExpanded(!expanded)}
            className="shrink-0 text-white/30 text-xs w-4"
          >
            {expanded ? "▼" : "▶"}
          </button>
        ) : (
          <span className="w-4" />
        )}
        <span className="flex-1 truncate" onClick={() => onEdit(node)}>{node.title}</span>
        <div className="shrink-0 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); onCreateChild(node.id); }}
            className="rounded p-0.5 text-white/30 hover:bg-white/5 hover:text-white/60 text-[10px]"
            title="添加子节点"
          >
            +
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(node.id); }}
            className="rounded p-0.5 text-white/30 hover:bg-red-500/10 hover:text-red-400 text-[10px]"
            title="删除"
          >
            ×
          </button>
        </div>
      </div>
      {expanded && node.children.map((child) => (
        <OutlineItem
          key={child.id}
          node={child}
          onEdit={onEdit}
          onDelete={onDelete}
          onCreateChild={onCreateChild}
        />
      ))}
    </div>
  );
}

export function OutlinePanel() {
  const currentProject = useProjectStore((s) => s.currentProject);
  const [items, setItems] = useState<Outline[]>([]);
  const [editing, setEditing] = useState<OutlineNode | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [addingChildOf, setAddingChildOf] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);

  useEffect(() => {
    if (!currentProject) return;
    const controller = new AbortController();
    outlineService.list(currentProject.id).then((res) => {
      if (!controller.signal.aborted && res.success && res.data) setItems(res.data);
    }).catch(() => {});
    return () => controller.abort();
  }, [currentProject]);

  if (!currentProject) return null;

  const tree = buildTree(items);

  const handleCreate = async (parentId?: string) => {
    const title = newTitle;
    if (!title.trim()) return;
    const parent = parentId ? items.find((i) => i.id === parentId) : undefined;
    const res = await outlineService.create(currentProject.id, {
      title: title.trim(),
      level: parent ? parent.level + 1 : 0,
      parentId: parentId || undefined,
    });
    if (res.success && res.data) {
      setItems((prev) => [...prev, res.data!]);
    }
    setNewTitle("");
    setAddingChildOf(null);
  };

  const handleUpdate = async () => {
    if (!editing || !editTitle.trim()) return;
    const res = await outlineService.update(currentProject.id, editing.id, {
      title: editTitle.trim(),
      content: editContent || undefined,
    });
    if (res.success && res.data) {
      setItems((prev) => prev.map((i) => i.id === editing.id ? res.data! : i));
    }
    setEditing(null);
  };

  const handleDelete = async (id: string) => {
    const res = await outlineService.remove(currentProject.id, id);
    if (res.success) {
      setItems((prev) => prev.filter((i) => i.id !== id));
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Add root node */}
      <div className="flex items-center gap-2 border-b border-white/5 px-3 py-2">
        <input
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          placeholder="新大纲节点..."
          className="flex-1 rounded border border-white/10 bg-white/5 px-2 py-1 text-xs text-white/70 placeholder:text-white/20 focus:outline-none focus:border-[var(--color-primary)]/50"
        />
        <button
          onClick={() => handleCreate()}
          disabled={!newTitle.trim()}
          className="rounded bg-[var(--color-primary)] px-2 py-1 text-xs text-white disabled:opacity-40"
        >
          添加
        </button>
        <button
          onClick={() => setShowTemplates(!showTemplates)}
          className={[
            "rounded px-2 py-1 text-xs transition-colors",
            showTemplates
              ? "bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
              : "text-white/30 hover:text-white/50",
          ].join(" ")}
          title="从模板导入"
        >
          模板
        </button>
      </div>

      {/* Tree or Template Gallery */}
      {showTemplates ? (
        <TemplateGallery
          onSelect={() => {
            setShowTemplates(false);
            outlineService.list(currentProject.id).then((res) => {
              if (res.success && res.data) setItems(res.data);
            });
          }}
        />
      ) : (
        <div className="flex-1 overflow-y-auto py-1">
          {tree.length === 0 && (
            <div className="py-8 text-center text-xs text-white/20">
              还没有大纲，添加你的第一个节点
            </div>
          )}
          {tree.map((node) => (
          <OutlineItem
            key={node.id}
            node={node}
            onEdit={(n) => {
              setEditing(n);
              setEditTitle(n.title);
              setEditContent(n.content || "");
            }}
            onDelete={handleDelete}
            onCreateChild={(parentId) => {
              setAddingChildOf(parentId);
              setNewTitle("");
            }}
          />
        ))}
        </div>
      )}

      {/* Add child input */}
      {addingChildOf && (
        <div className="flex items-center gap-2 border-t border-white/5 px-3 py-2">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate(addingChildOf)}
            placeholder="子节点标题..."
            className="flex-1 rounded border border-white/10 bg-white/5 px-2 py-1 text-xs text-white/70 placeholder:text-white/20 focus:outline-none"
            autoFocus
          />
          <button
            onClick={() => handleCreate(addingChildOf)}
            className="rounded bg-[var(--color-primary)] px-2 py-1 text-xs text-white"
          >
            添加
          </button>
          <button
            onClick={() => setAddingChildOf(null)}
            className="rounded px-2 py-1 text-xs text-white/40 hover:bg-white/5"
          >
            取消
          </button>
        </div>
      )}

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-[oklch(0.16_0_0)] p-4 shadow-2xl">
            <h3 className="mb-3 text-sm font-medium text-white/80">编辑大纲节点</h3>
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full rounded border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white/80 mb-2 focus:outline-none focus:border-[var(--color-primary)]/50"
            />
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              placeholder="大纲描述..."
              rows={4}
              className="w-full rounded border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white/80 placeholder:text-white/15 focus:outline-none resize-none"
            />
            <div className="flex justify-end gap-2 mt-3">
              <button onClick={() => setEditing(null)} className="rounded px-3 py-1.5 text-sm text-white/40 hover:bg-white/5">取消</button>
              <button onClick={handleUpdate} className="rounded bg-[var(--color-primary)] px-3 py-1.5 text-sm text-white hover:opacity-90">保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
