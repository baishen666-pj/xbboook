import { useEditor, EditorContent } from "@tiptap/react";
import { useEffect, useRef, useCallback } from "react";
import { getEditorExtensions } from "./editorExtensions";
import { GhostTextToolbar } from "./GhostTextToolbar";
import { useEditorStore } from "@/stores/editorStore";
import { useUiStore } from "@/stores/uiStore";
import { useGhostCompletion } from "@/hooks/useGhostCompletion";
import "@/styles/editor.css";

interface NovelEditorProps {
  content: string;
  onUpdate?: (text: string) => void;
}

export function NovelEditor({ content, onUpdate }: NovelEditorProps) {
  const updateContent = useEditorStore((s) => s.updateContent);
  const setEditor = useEditorStore((s) => s.setEditor);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useGhostCompletion();

  const handleUpdate = useCallback(
    (text: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        updateContent(text);
        onUpdate?.(text);
      }, 1000);
    },
    [updateContent, onUpdate]
  );

  const editor = useEditor({
    extensions: getEditorExtensions(),
    content,
    editorProps: {
      attributes: {
        class: "tiptap ProseMirror",
      },
    },
    onUpdate: ({ editor: ed }) => {
      handleUpdate(ed.getHTML());
      // Typewriter scroll: center cursor vertically in focus mode
      if (useUiStore.getState().isFocusMode) {
        requestAnimationFrame(() => {
          const { from } = ed.state.selection;
          const coords = ed.view.coordsAtPos(from);
          const editorEl = ed.view.dom.closest('.overflow-y-auto') as HTMLElement;
          if (editorEl) {
            const editorRect = editorEl.getBoundingClientRect();
            const cursorCenter = coords.top - editorRect.top + editorEl.scrollTop - editorRect.height / 2;
            editorEl.scrollTo({ top: cursorCenter, behavior: 'smooth' });
          }
        });
      }
    },
    onCreate: ({ editor: ed }) => {
      setEditor(ed);
    },
    immediatelyRender: false,
  });

  // Sync content from outside
  const prevContentRef = useRef(content);
  useEffect(() => {
    if (editor && content !== prevContentRef.current) {
      prevContentRef.current = content;
      const currentPos = editor.state.selection.from;
      editor.commands.setContent(content, { emitUpdate: false });
      try {
        const maxPos = editor.state.doc.content.size;
        editor.commands.setTextSelection(
          Math.min(currentPos, maxPos - 1)
        );
      } catch {
        // ignore position errors
      }
    }
  }, [editor, content]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      setEditor(null);
    };
  }, []);

  return (
    <div className="relative h-full overflow-y-auto smooth-scroll">
      <EditorContent editor={editor} className="h-full" />
      <GhostTextToolbar />
    </div>
  );
}
