import { useState, useEffect } from "react";
import { useEditorStore } from "@/stores/editorStore";
import { useProjectStore } from "@/stores/projectStore";
import { versionService } from "@/services/versionService";

export function GhostTextToolbar() {
  const editor = useEditorStore((s) => s.editorInstance);
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!editor) return;

    const update = () => {
      const { from } = editor.state.selection;
      const $pos = editor.state.doc.resolve(from);
      const ghostMark = editor.state.schema.marks.ghostText;
      if (!ghostMark) return;

      const hasGhost = $pos
        .marks()
        .some((m) => m.type.name === "ghostText");
      if (!hasGhost) {
        setVisible(false);
        return;
      }

      const coords = editor.view.coordsAtPos(from);
      const editorBox = editor.view.dom.parentElement?.getBoundingClientRect();
      if (!editorBox) return;

      setVisible(true);
      setPos({
        top: coords.top - editorBox.top - 40,
        left: coords.left - editorBox.left,
      });
    };

    editor.on("selectionUpdate", update);
    editor.on("transaction", update);
    return () => {
      editor.off("selectionUpdate", update);
      editor.off("transaction", update);
    };
  }, [editor]);

  if (!visible || !editor) return null;

  return (
    <div
      className="absolute z-20 flex items-center gap-1 rounded-lg border border-white/10 bg-[oklch(0.18_0.01_260)] px-2 py-1 shadow-xl"
      style={{ top: pos.top, left: pos.left }}
    >
      <button
        onClick={async () => {
          // Create pre-AI snapshot before adopting ghost text
          const pid = useProjectStore.getState().currentProject?.id;
          const cid = useEditorStore.getState().activeChapterId;
          if (pid && cid) {
            try {
              const res = await versionService.create(pid, cid, { label: "AI编辑前快照" });
              if (res.success && res.data) {
                useEditorStore.getState().setAiEditSnapshot(res.data.id);
              }
            } catch { /* best-effort */ }
          }
          const { from, to } = editor.state.selection;
          let start = from;
          let end = to;
          editor.state.doc.nodesBetween(from, to, (node, nodePos) => {
            const ghostMark = node.marks.find(
              (m) => m.type.name === "ghostText"
            );
            if (ghostMark) {
              start = Math.min(start, nodePos);
              end = Math.max(end, nodePos + node.nodeSize);
            }
          });
          const ghostMark = editor.state.schema.marks.ghostText;
          editor
            .chain()
            .focus()
            .command(({ tr }) => {
              tr.removeMark(start, end, ghostMark);
              return true;
            })
            .run();
          setVisible(false);
        }}
        className="flex items-center gap-1 rounded px-2 py-0.5 text-xs text-emerald-400 hover:bg-emerald-500/10"
        title="采纳文本"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
          <polyline points="20 6 9 17 4 12" />
        </svg>
        采纳
      </button>
      <button
        onClick={() => {
          const { from, to } = editor.state.selection;
          let start = from;
          let end = to;
          const ranges: [number, number][] = [];
          editor.state.doc.nodesBetween(from, to, (node, nodePos) => {
            const ghostMark = node.marks.find(
              (m) => m.type.name === "ghostText"
            );
            if (ghostMark) {
              ranges.push([nodePos, nodePos + node.nodeSize]);
              start = Math.min(start, nodePos);
              end = Math.max(end, nodePos + node.nodeSize);
            }
          });
          editor
            .chain()
            .focus()
            .command(({ tr }) => {
              for (let i = ranges.length - 1; i >= 0; i--) {
                const r = ranges[i];
                if (r) tr.delete(r[0], r[1]);
              }
              return true;
            })
            .run();
          setVisible(false);
        }}
        className="flex items-center gap-1 rounded px-2 py-0.5 text-xs text-red-400 hover:bg-red-500/10"
        title="拒绝文本"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
        拒绝
      </button>
    </div>
  );
}
