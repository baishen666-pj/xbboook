import { useState, useEffect, useCallback } from "react";
import { useEditorStore } from "@/stores/editorStore";
import { useProjectStore } from "@/stores/projectStore";
import { fetchTextEdit } from "@/services/aiService";
import { useAiStore } from "@/stores/aiStore";

const EDIT_ACTIONS = [
  { skillId: "polish", label: "润色", icon: "✨" },
  { skillId: "rewrite", label: "改写", icon: "🔄" },
  { skillId: "expand", label: "扩写", icon: "📝" },
  { skillId: "compress", label: "缩写", icon: "✂️" },
  { skillId: "deai", label: "去AI味", icon: "🧹" },
] as const;

const STYLE_OPTIONS = ["热血", "轻松", "暗黑", "唯美", "幽默", "悬疑", "浪漫"];

interface EditResult {
  skillId: string;
  original: string;
  result: string;
}

export function AiEditFloatingBar() {
  const editor = useEditorStore((s) => s.editorInstance);
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [selectedText, setSelectedText] = useState("");
  const [loading, setLoading] = useState(false);
  const [showStyles, setShowStyles] = useState(false);
  const [editResult, setEditResult] = useState<EditResult | null>(null);
  const currentProject = useProjectStore((s) => s.currentProject);
  const isPanelOpen = useAiStore((s) => s.isOpen);

  useEffect(() => {
    if (!editor) return;

    const handleSelection = () => {
      const { from, to, empty } = editor.state.selection;
      if (empty || from === to) {
        setVisible(false);
        setEditResult(null);
        setShowStyles(false);
        return;
      }

      const text = editor.state.doc.textBetween(from, to, "\n");
      if (text.trim().length < 5) {
        setVisible(false);
        return;
      }

      setSelectedText(text);

      const coords = editor.view.coordsAtPos(from);
      const editorBox = editor.view.dom.parentElement?.getBoundingClientRect();
      if (!editorBox) return;

      setPos({
        top: coords.top - editorBox.top - 48,
        left: Math.min(coords.left - editorBox.left, editorBox.width - 320),
      });
      setVisible(true);
      setEditResult(null);
      setShowStyles(false);
    };

    editor.on("selectionUpdate", handleSelection);
    return () => { editor.off("selectionUpdate", handleSelection); };
  }, [editor]);

  const handleEdit = useCallback(async (skillId: string, targetStyle?: string) => {
    if (!currentProject || !selectedText || loading) return;

    setLoading(true);
    setEditResult(null);
    try {
      const result = await fetchTextEdit(currentProject.id, skillId, selectedText, targetStyle);
      setEditResult({ skillId, original: selectedText, result });
    } catch {
      // Error handled silently, user can retry
    }
    setLoading(false);
  }, [currentProject, selectedText, loading]);

  const handleAccept = useCallback(() => {
    if (!editResult || !editor) return;

    const { from, to } = editor.state.selection;
    if (from === to) return;

    editor.chain().focus().setTextSelection({ from, to }).insertContent(editResult.result).run();
    setEditResult(null);
    setVisible(false);
  }, [editResult, editor]);

  const handleReject = useCallback(() => {
    setEditResult(null);
  }, []);

  if (!visible || !editor || isPanelOpen) return null;

  return (
    <div
      className="absolute z-30 flex flex-col gap-1"
      style={{ top: pos.top, left: pos.left }}
    >
      {loading && (
        <div className="flex items-center gap-2 rounded-lg bg-[oklch(0.18_0_0)] border border-white/10 px-3 py-2 shadow-lg">
          <div className="h-3 w-3 animate-spin rounded-full border-2 border-white/20 border-t-[var(--color-primary)]" />
          <span className="text-xs text-white/60">AI 编辑中...</span>
        </div>
      )}

      {!loading && editResult && (
        <div className="w-80 rounded-lg bg-[oklch(0.18_0_0)] border border-white/10 shadow-xl overflow-hidden">
          <div className="max-h-48 overflow-y-auto p-2 text-xs text-white/80 whitespace-pre-wrap">
            {editResult.result}
          </div>
          <div className="flex border-t border-white/5">
            <button onClick={handleAccept} className="flex-1 px-3 py-1.5 text-xs text-green-400 hover:bg-white/5 transition-colors">
              采纳替换
            </button>
            <button onClick={handleReject} className="flex-1 px-3 py-1.5 text-xs text-white/50 hover:bg-white/5 transition-colors border-l border-white/5">
              取消
            </button>
          </div>
        </div>
      )}

      {!loading && !editResult && !showStyles && (
        <div className="flex items-center gap-0.5 rounded-lg bg-[oklch(0.18_0_0)] border border-white/10 px-1 py-1 shadow-lg">
          {EDIT_ACTIONS.map((action) => (
            <button
              key={action.skillId}
              onClick={() => void handleEdit(action.skillId)}
              className="rounded px-2 py-1 text-xs text-white/70 hover:bg-white/10 hover:text-white transition-colors whitespace-nowrap"
              title={action.label}
            >
              {action.icon} {action.label}
            </button>
          ))}
          <button
            onClick={() => setShowStyles(true)}
            className="rounded px-2 py-1 text-xs text-white/70 hover:bg-white/10 hover:text-white transition-colors whitespace-nowrap"
            title="风格转换"
          >
            🎭 风格
          </button>
        </div>
      )}

      {!loading && !editResult && showStyles && (
        <div className="flex items-center gap-0.5 rounded-lg bg-[oklch(0.18_0_0)] border border-white/10 px-1 py-1 shadow-lg">
          <button
            onClick={() => setShowStyles(false)}
            className="rounded px-2 py-1 text-xs text-white/40 hover:bg-white/10 transition-colors"
          >
            ←
          </button>
          {STYLE_OPTIONS.map((s) => (
            <button
              key={s}
              onClick={() => { setShowStyles(false); void handleEdit("style", s); }}
              className="rounded px-2 py-1 text-xs text-white/70 hover:bg-white/10 hover:text-white transition-colors whitespace-nowrap"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
