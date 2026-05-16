import { useState, useEffect, useRef } from "react";
import { useProjectStore } from "@/stores/projectStore";
import { useEditorStore } from "@/stores/editorStore";
import { outlineService } from "@/services/outlineService";
import { streamAi } from "@/services/aiService";
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

function OutlineItem({ node, onEdit, onDelete, onCreateChild, onGenerate, generatingId }: {
  node: OutlineNode;
  onEdit: (node: OutlineNode) => void;
  onDelete: (id: string) => void;
  onCreateChild: (parentId: string) => void;
  onGenerate: (node: OutlineNode) => void;
  generatingId: string | null;
}) {
  const [expanded, setExpanded] = useState(true);
  const indent = node.level * 16;
  const isGenerating = generatingId === node.id;

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
            onClick={(e) => { e.stopPropagation(); onGenerate(node); }}
            disabled={isGenerating}
            className="rounded p-0.5 text-white/30 hover:bg-[var(--color-primary)]/10 hover:text-[var(--color-primary)] text-[10px] disabled:opacity-40"
            title={isGenerating ? "生成中..." : "AI 生成章节"}
          >
            {isGenerating ? "⏳" : "📖"}
          </button>
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
          onGenerate={onGenerate}
          generatingId={generatingId}
        />
      ))}
    </div>
  );
}

export function OutlinePanel() {
  const currentProject = useProjectStore((s) => s.currentProject);
  const activeChapterId = useEditorStore((s) => s.activeChapterId);
  const updateContent = useEditorStore((s) => s.updateContent);
  const editorInstance = useEditorStore((s) => s.editorInstance);
  const [items, setItems] = useState<Outline[]>([]);
  const [editing, setEditing] = useState<OutlineNode | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [addingChildOf, setAddingChildOf] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [generatingStatus, setGeneratingStatus] = useState<string>("");
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!currentProject) return;
    const controller = new AbortController();
    outlineService.list(currentProject.id).then((res) => {
      if (!controller.signal.aborted && res.success && res.data) setItems(res.data);
    }).catch(() => {});
    return () => controller.abort();
  }, [currentProject]);

  // Cleanup abort on unmount
  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

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

  const handleGenerate = async (node: OutlineNode) => {
    if (!activeChapterId || generatingId) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setGeneratingId(node.id);
    setGeneratingStatus("正在生成...");

    // Collect all ancestor + self content for context
    const outlineParts: string[] = [];
    const collectContent = (n: OutlineNode, depth: number) => {
      const prefix = "#".repeat(depth + 1);
      outlineParts.push(`${prefix} ${n.title}`);
      if (n.content) outlineParts.push(n.content);
      for (const child of n.children) {
        collectContent(child, depth + 1);
      }
    };
    collectContent(node, 0);
    const outlineContent = outlineParts.join("\n");

    let fullContent = "";

    try {
      for await (const event of streamAi({
        projectId: currentProject.id,
        skillId: "chapter-generate",
        chapterId: activeChapterId,
        outlineContent,
      }, controller.signal)) {
        if (controller.signal.aborted) break;
        if (event.type === "chunk") {
          fullContent += event.content;
          setGeneratingStatus(`生成中... ${fullContent.length} 字`);
        }
      }

      if (fullContent && !controller.signal.aborted) {
        // Insert into editor via Tiptap
        if (editorInstance) {
          const currentContent = editorInstance.getHTML();
          const separator = currentContent && currentContent !== "<p></p>" ? "\n\n" : "";
          editorInstance.commands.setContent(currentContent + separator + fullContent);
          const html = editorInstance.getHTML();
          updateContent(html);
        } else {
          const currentText = useEditorStore.getState().content;
          const separator = currentText ? "\n\n" : "";
          updateContent(currentText + separator + fullContent);
        }
        setGeneratingStatus("生成完成");
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        const message = err instanceof Error ? err.message : "生成失败";
        setGeneratingStatus(`错误: ${message}`);
      }
    } finally {
      setTimeout(() => {
        setGeneratingId(null);
        setGeneratingStatus("");
      }, 2000);
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

      {/* Generating status */}
      {generatingStatus && (
        <div className="flex items-center gap-2 border-b border-[var(--color-primary)]/10 bg-[var(--color-primary)]/5 px-3 py-1.5 text-[11px] text-[var(--color-primary)]">
          <span className="inline-block h-2 w-2 rounded-full bg-[var(--color-primary)] animate-[pulse-subtle_1.5s_ease-in-out_infinite]" />
          {generatingStatus}
          {generatingId && (
            <button
              onClick={() => { abortRef.current?.abort(); setGeneratingId(null); setGeneratingStatus(""); }}
              className="ml-auto text-white/40 hover:text-white/60"
            >
              取消
            </button>
          )}
        </div>
      )}

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
            onGenerate={handleGenerate}
            generatingId={generatingId}
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
