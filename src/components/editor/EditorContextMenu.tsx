import { useState, useEffect, useCallback } from "react";
import { useAiStore } from "@/stores/aiStore";
import { useEditorStore } from "@/stores/editorStore";
import { useProjectStore } from "@/stores/projectStore";
import { useCollabStore } from "@/stores/collabStore";
import { useCommentStore } from "@/stores/commentStore";

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  selectedText: string;
}

const AI_ACTIONS = [
  { skillId: "continue", label: "续写", icon: "✍️" },
  { skillId: "rewrite", label: "改写", icon: "🔄" },
  { skillId: "polish", label: "润色", icon: "✨" },
  { skillId: "style", label: "风格转换", icon: "🎭" },
  { skillId: "dialogue", label: "生成对话", icon: "💬" },
  { skillId: "consistency", label: "一致性检查", icon: "🔍" },
  { skillId: "inspiration", label: "灵感", icon: "💡" },
  { skillId: "deai", label: "去AI味", icon: "🧹" },
] as const;

export function EditorContextMenu() {
  const [menu, setMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    selectedText: "",
  });

  const { openPanel, setActiveSkill } = useAiStore();

  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".tiptap")) return;

      const selection = window.getSelection();
      const text = selection?.toString().trim() || "";

      if (text.length > 0) {
        e.preventDefault();
        useEditorStore.getState().setSelectedText(text);
        setMenu({ visible: true, x: e.clientX, y: e.clientY, selectedText: text });
      }
    };

    const handleClick = () => setMenu((m) => ({ ...m, visible: false }));

    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("click", handleClick);
    return () => {
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("click", handleClick);
    };
  }, []);

  const handleAction = useCallback(
    (skillId: string) => {
      setActiveSkill(skillId);
      openPanel();
      setMenu((m) => ({ ...m, visible: false }));
    },
    [setActiveSkill, openPanel]
  );

  const handleAddComment = useCallback(() => {
    const currentProject = useProjectStore.getState().currentProject;
    const currentUser = useCollabStore.getState().currentUser;
    const activeChapterId = useEditorStore.getState().activeChapterId;
    if (!currentProject || !currentUser || !activeChapterId || !menu.selectedText) return;

    const selection = window.getSelection();
    const range = selection?.rangeCount ? selection!.getRangeAt(0) : null;

    useCommentStore.getState().addComment(currentProject.id, activeChapterId, {
      content: `关于「${menu.selectedText.slice(0, 50)}」的批注`,
      userId: currentUser.id,
      selectionText: menu.selectedText.slice(0, 200),
      selectionFrom: range?.startOffset,
      selectionTo: range?.endOffset,
    });
    setMenu((m) => ({ ...m, visible: false }));
  }, [menu.selectedText]);

  if (!menu.visible) return null;

  const menuWidth = 180;
  const menuHeight = AI_ACTIONS.length * 36 + 40;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const x = menu.x + menuWidth > vw ? Math.max(4, vw - menuWidth - 4) : menu.x;
  const y = menu.y + menuHeight > vh ? Math.max(4, vh - menuHeight - 4) : menu.y;

  return (
    <div
      className="fixed z-50 min-w-[180px] rounded-lg border border-white/10 bg-[oklch(0.18_0_0)] py-1 shadow-xl"
      style={{ left: x, top: y }}
    >
      <div className="px-3 py-1.5 text-xs text-white/40 border-b border-white/5">
        AI 操作
      </div>
      {AI_ACTIONS.map((action) => (
        <button
          key={action.skillId}
          onClick={() => handleAction(action.skillId)}
          className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-white/70 hover:bg-white/5 hover:text-white transition-colors"
        >
          <span>{action.icon}</span>
          <span>{action.label}</span>
        </button>
      ))}
      <div className="my-1 border-t border-white/5" />
      <button
        onClick={handleAddComment}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-white/70 hover:bg-white/5 hover:text-white transition-colors"
      >
        <span>💬</span>
        <span>添加批注</span>
      </button>
    </div>
  );
}
