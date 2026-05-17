import { useState, useEffect, useRef } from "react";
import { useProjectStore } from "@/stores/projectStore";
import { useEditorStore } from "@/stores/editorStore";
import { outlineService } from "@/services/outlineService";
import { outlineEnhanceService } from "@/services/outlineEnhanceService";
import { streamAi } from "@/services/aiService";
import { TemplateGallery } from "@/components/template/TemplateGallery";
import type { Outline } from "@/types/project";
import type { OutlineAnalysisResult } from "@/services/outlineEnhanceService";

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

function OutlineItem({ node, onEdit, onDelete, onCreateChild, onGenerate, onExpand, generatingId, expandingId }: {
  node: OutlineNode;
  onEdit: (node: OutlineNode) => void;
  onDelete: (id: string) => void;
  onCreateChild: (parentId: string) => void;
  onGenerate: (node: OutlineNode) => void;
  onExpand: (node: OutlineNode) => void;
  generatingId: string | null;
  expandingId: string | null;
}) {
  const [expanded, setExpanded] = useState(true);
  const indent = node.level * 16;
  const isGenerating = generatingId === node.id;
  const isExpanding = expandingId === node.id;

  return (
    <div>
      <div
        className="group flex items-center gap-1.5 rounded px-2 py-1 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)] cursor-pointer"
        style={{ paddingLeft: `${8 + indent}px` }}
      >
        {node.children.length > 0 ? (
          <button
            onClick={() => setExpanded(!expanded)}
            className="shrink-0 text-[var(--color-text-muted)] text-xs w-4"
          >
            {expanded ? "▼" : "▶"}
          </button>
        ) : (
          <span className="w-4" />
        )}
        <span className="flex-1 truncate" onClick={() => onEdit(node)}>{node.title}</span>
        <div className="shrink-0 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); onExpand(node); }}
            disabled={isExpanding}
            className="rounded p-0.5 text-[var(--color-text-muted)] hover:bg-purple-500/10 hover:text-purple-400 text-[10px] disabled:opacity-40"
            title={isExpanding ? "AI 扩展中..." : "AI 扩展子节点"}
          >
            {isExpanding ? "⏳" : "🧩"}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onGenerate(node); }}
            disabled={isGenerating}
            className="rounded p-0.5 text-[var(--color-text-muted)] hover:bg-[var(--color-primary)]/10 hover:text-[var(--color-primary)] text-[10px] disabled:opacity-40"
            title={isGenerating ? "生成中..." : "AI 生成章节"}
          >
            {isGenerating ? "⏳" : "📖"}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onCreateChild(node.id); }}
            className="rounded p-0.5 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-secondary)] text-[10px]"
            title="添加子节点"
          >
            +
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(node.id); }}
            className="rounded p-0.5 text-[var(--color-text-muted)] hover:bg-red-500/10 hover:text-red-400 text-[10px]"
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
          onExpand={onExpand}
          generatingId={generatingId}
          expandingId={expandingId}
        />
      ))}
    </div>
  );
}

function OutlineAnalysisView({ analysis, onClose }: {
  analysis: OutlineAnalysisResult;
  onClose: () => void;
}) {
  const scoreColor = (score: number) => {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-lg max-h-[80vh] overflow-y-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-[var(--color-text-primary)]">AI 大纲分析</h3>
          <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] text-xs">×</button>
        </div>

        {/* Overall Score */}
        <div className="flex items-center justify-center gap-3 mb-4 p-3 rounded-lg bg-[var(--color-surface-1)]">
          <div className={`text-3xl font-bold ${scoreColor(analysis.overall_score)}`}>
            {analysis.overall_score}
          </div>
          <div className="text-xs text-[var(--color-text-muted)]">/100 综合评分</div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          {[
            { label: '完整度', value: analysis.completeness },
            { label: '节奏感', value: analysis.pacing_score },
            { label: '冲突密度', value: analysis.conflict_density },
            { label: '角色弧线', value: analysis.character_arc_coverage },
          ].map((m) => (
            <div key={m.label} className="rounded border border-[var(--color-border)] p-2">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] text-[var(--color-text-muted)]">{m.label}</span>
                <span className={`text-xs font-medium ${scoreColor(m.value)}`}>{m.value}</span>
              </div>
              <div className="h-1 rounded-full bg-[var(--color-surface-1)] overflow-hidden">
                <div
                  className="h-full rounded-full bg-[var(--color-primary)] transition-all"
                  style={{ width: `${m.value}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Strengths */}
        {analysis.strengths.length > 0 && (
          <div className="mb-3">
            <div className="text-[10px] font-medium text-green-400 mb-1">优点</div>
            {analysis.strengths.map((s, i) => (
              <div key={i} className="text-xs text-[var(--color-text-secondary)] pl-2 py-0.5">• {s}</div>
            ))}
          </div>
        )}

        {/* Weaknesses */}
        {analysis.weaknesses.length > 0 && (
          <div className="mb-3">
            <div className="text-[10px] font-medium text-yellow-400 mb-1">不足</div>
            {analysis.weaknesses.map((w, i) => (
              <div key={i} className="text-xs text-[var(--color-text-secondary)] pl-2 py-0.5">• {w}</div>
            ))}
          </div>
        )}

        {/* Suggestions */}
        {analysis.suggestions.length > 0 && (
          <div className="mb-4">
            <div className="text-[10px] font-medium text-[var(--color-primary)] mb-1">建议</div>
            {analysis.suggestions.map((s, i) => (
              <div key={i} className="text-xs text-[var(--color-text-secondary)] pl-2 py-0.5">• {s}</div>
            ))}
          </div>
        )}

        <div className="flex justify-end">
          <button onClick={onClose} className="rounded bg-[var(--color-primary)] px-3 py-1.5 text-xs text-white hover:opacity-90">关闭</button>
        </div>
      </div>
    </div>
  );
}

function OutlineTemplateModal({ projectId, onDone, onCancel }: {
  projectId: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [genre, setGenre] = useState('');
  const [style, setStyle] = useState('');
  const [premise, setPremise] = useState('');
  const [targetLength, setTargetLength] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!genre.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const res = await outlineEnhanceService.template(projectId, {
        genre: genre.trim(),
        style: style.trim() || undefined,
        premise: premise.trim() || undefined,
        targetLength: targetLength.trim() || undefined,
      });

      if (res.success && res.data) {
        const template = res.data;
        // Create the root outline node
        const rootRes = await outlineService.create(projectId, {
          title: template.title || genre,
          content: `AI生成模板：${genre}${style ? ` / ${style}` : ''}`,
        });

        if (rootRes.success && rootRes.data && template.children) {
          // Create children
          for (let i = 0; i < template.children.length; i++) {
            const child = template.children[i];
            await outlineService.create(projectId, {
              title: child.title,
              content: child.summary || '',
              parentId: rootRes.data.id,
              level: 1,
            });
          }
        }
        onDone();
      } else {
        setError(res.error || '生成失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '请求失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onCancel}>
      <div
        className="w-full max-w-md rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-4">AI 生成大纲模板</h3>

        <div className="space-y-3">
          <div>
            <label className="text-[10px] text-[var(--color-text-muted)] mb-1 block">类型 *</label>
            <select
              value={genre}
              onChange={(e) => setGenre(e.target.value)}
              className="w-full rounded border border-[var(--color-border)] bg-[var(--color-surface-1)] px-2 py-1.5 text-xs text-[var(--color-text-primary)]"
            >
              <option value="">选择类型</option>
              <option value="玄幻">玄幻</option>
              <option value="仙侠">仙侠</option>
              <option value="都市">都市</option>
              <option value="科幻">科幻</option>
              <option value="历史">历史</option>
              <option value="悬疑">悬疑</option>
              <option value="言情">言情</option>
              <option value="武侠">武侠</option>
              <option value="游戏竞技">游戏竞技</option>
              <option value="奇幻">奇幻</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] text-[var(--color-text-muted)] mb-1 block">风格</label>
            <input
              type="text"
              value={style}
              onChange={(e) => setStyle(e.target.value)}
              placeholder="如：热血、轻松、暗黑"
              className="w-full rounded border border-[var(--color-border)] bg-[var(--color-surface-1)] px-2 py-1.5 text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]"
            />
          </div>

          <div>
            <label className="text-[10px] text-[var(--color-text-muted)] mb-1 block">故事设定</label>
            <textarea
              value={premise}
              onChange={(e) => setPremise(e.target.value)}
              placeholder="简述故事核心设定..."
              rows={3}
              className="w-full rounded border border-[var(--color-border)] bg-[var(--color-surface-1)] px-2 py-1.5 text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] resize-none"
            />
          </div>

          <div>
            <label className="text-[10px] text-[var(--color-text-muted)] mb-1 block">目标长度</label>
            <select
              value={targetLength}
              onChange={(e) => setTargetLength(e.target.value)}
              className="w-full rounded border border-[var(--color-border)] bg-[var(--color-surface-1)] px-2 py-1.5 text-xs text-[var(--color-text-primary)]"
            >
              <option value="">默认 (80-120章)</option>
              <option value="短篇 (<50章)">短篇 (&lt;50章)</option>
              <option value="中篇 (50-100章)">中篇 (50-100章)</option>
              <option value="长篇 (100-200章)">长篇 (100-200章)</option>
              <option value="超长篇 (>200章)">超长篇 (&gt;200章)</option>
            </select>
          </div>

          {error && (
            <div className="rounded bg-red-500/10 p-2 text-xs text-red-400">{error}</div>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onCancel} className="rounded px-3 py-1.5 text-xs text-[var(--color-text-muted)] hover:bg-[var(--color-surface-3)]">取消</button>
          <button
            onClick={handleGenerate}
            disabled={loading || !genre.trim()}
            className="rounded bg-[var(--color-primary)] px-3 py-1.5 text-xs text-white hover:opacity-90 disabled:opacity-50"
          >
            {loading ? '生成中...' : '生成模板'}
          </button>
        </div>
      </div>
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
  const [expandingId, setExpandingId] = useState<string | null>(null);
  const [showAiTemplate, setShowAiTemplate] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<OutlineAnalysisResult | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const reloadOutlines = () => {
    if (!currentProject) return;
    outlineService.list(currentProject.id).then((res) => {
      if (res.success && res.data) setItems(res.data);
    }).catch(() => {});
  };

  useEffect(() => {
    if (!currentProject) return;
    const controller = new AbortController();
    outlineService.list(currentProject.id).then((res) => {
      if (!controller.signal.aborted && res.success && res.data) setItems(res.data);
    }).catch(() => {});
    return () => controller.abort();
  }, [currentProject]);

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

  const handleExpand = async (node: OutlineNode) => {
    if (expandingId) return;
    setExpandingId(node.id);

    try {
      const res = await outlineEnhanceService.expand(currentProject.id, node.id);
      if (res.success && res.data) {
        setItems((prev) => [...prev, ...res.data!.created]);
      }
    } catch (err) {
      console.warn('[Outline] AI expand failed:', err);
    } finally {
      setExpandingId(null);
    }
  };

  const handleAnalyze = async () => {
    if (analyzing) return;
    setAnalyzing(true);
    try {
      const res = await outlineEnhanceService.analyze(currentProject.id);
      if (res.success && res.data) {
        setAnalysisResult(res.data);
      }
    } catch (err) {
      console.warn('[Outline] AI analyze failed:', err);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleGenerate = async (node: OutlineNode) => {
    if (!activeChapterId || generatingId) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setGeneratingId(node.id);
    setGeneratingStatus("正在生成...");

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
      {/* Toolbar */}
      <div className="flex items-center gap-2 border-b border-[var(--color-border)] px-3 py-2">
        <input
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          placeholder="新大纲节点..."
          className="flex-1 rounded border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 py-1 text-xs text-[var(--color-text-secondary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-primary)]/50"
        />
        <button
          onClick={() => handleCreate()}
          disabled={!newTitle.trim()}
          className="rounded bg-[var(--color-primary)] px-2 py-1 text-xs text-white disabled:opacity-40"
        >
          添加
        </button>
        <button
          onClick={() => setShowAiTemplate(true)}
          className="rounded px-2 py-1 text-xs text-purple-400 hover:bg-purple-500/10 transition-colors"
          title="AI 生成大纲模板"
        >
          AI模板
        </button>
        <button
          onClick={handleAnalyze}
          disabled={analyzing || items.length === 0}
          className="rounded px-2 py-1 text-xs text-[var(--color-text-muted)] hover:bg-[var(--color-primary)]/10 hover:text-[var(--color-primary)] disabled:opacity-40 transition-colors"
          title="AI 分析大纲结构"
        >
          {analyzing ? '分析中...' : 'AI分析'}
        </button>
        <button
          onClick={() => setShowTemplates(!showTemplates)}
          className={[
            "rounded px-2 py-1 text-xs transition-colors",
            showTemplates
              ? "bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
              : "text-[var(--color-text-muted)] hover:text-[var(--color-text-muted)]",
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
              className="ml-auto text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
            >
              取消
            </button>
          )}
        </div>
      )}

      {/* Expanding status */}
      {expandingId && (
        <div className="flex items-center gap-2 border-b border-purple-500/10 bg-purple-500/5 px-3 py-1.5 text-[11px] text-purple-400">
          <span className="inline-block h-2 w-2 rounded-full bg-purple-400 animate-[pulse-subtle_1.5s_ease-in-out_infinite]" />
          AI 扩展大纲中...
        </div>
      )}

      {/* Tree or Template Gallery */}
      {showTemplates ? (
        <TemplateGallery
          onSelect={() => {
            setShowTemplates(false);
            reloadOutlines();
          }}
        />
      ) : (
        <div className="flex-1 overflow-y-auto py-1">
          {tree.length === 0 && (
            <div className="py-8 text-center text-xs text-[var(--color-text-muted)]">
              还没有大纲，添加你的第一个节点或使用 AI 生成模板
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
            onExpand={handleExpand}
            generatingId={generatingId}
            expandingId={expandingId}
          />
        ))}
        </div>
      )}

      {/* Add child input */}
      {addingChildOf && (
        <div className="flex items-center gap-2 border-t border-[var(--color-border)] px-3 py-2">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate(addingChildOf)}
            placeholder="子节点标题..."
            className="flex-1 rounded border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 py-1 text-xs text-[var(--color-text-secondary)] placeholder:text-[var(--color-text-muted)] focus:outline-none"
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
            className="rounded px-2 py-1 text-xs text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)]"
          >
            取消
          </button>
        </div>
      )}

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4 shadow-2xl">
            <h3 className="mb-3 text-sm font-medium text-[var(--color-text-primary)]">编辑大纲节点</h3>
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full rounded border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 py-1.5 text-sm text-[var(--color-text-primary)] mb-2 focus:outline-none focus:border-[var(--color-primary)]/50"
            />
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              placeholder="大纲描述..."
              rows={4}
              className="w-full rounded border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 py-1.5 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none resize-none"
            />
            <div className="flex justify-end gap-2 mt-3">
              <button onClick={() => setEditing(null)} className="rounded px-3 py-1.5 text-sm text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)]">取消</button>
              <button onClick={handleUpdate} className="rounded bg-[var(--color-primary)] px-3 py-1.5 text-sm text-white hover:opacity-90">保存</button>
            </div>
          </div>
        </div>
      )}

      {/* AI Template Modal */}
      {showAiTemplate && (
        <OutlineTemplateModal
          projectId={currentProject.id}
          onDone={() => { setShowAiTemplate(false); reloadOutlines(); }}
          onCancel={() => setShowAiTemplate(false)}
        />
      )}

      {/* AI Analysis View */}
      {analysisResult && (
        <OutlineAnalysisView
          analysis={analysisResult}
          onClose={() => setAnalysisResult(null)}
        />
      )}
    </div>
  );
}
