import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import CharacterCount from "@tiptap/extension-character-count";
import Highlight from "@tiptap/extension-highlight";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import { Markdown } from "tiptap-markdown";
import { useEffect, useRef, useCallback } from "react";
import { GhostMark } from "./GhostMark";
import { useEditorStore } from "@/stores/editorStore";
import { useUiStore } from "@/stores/uiStore";
import "@/styles/editor.css";

interface NovelEditorProps {
  content: string;
  onUpdate?: (text: string) => void;
}

export function NovelEditor({ content, onUpdate }: NovelEditorProps) {
  const updateContent = useEditorStore((s) => s.updateContent);
  const setEditor = useEditorStore((s) => s.setEditor);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({
        placeholder: "开始写作你的故事...",
      }),
      CharacterCount,
      Highlight.configure({
        multicolor: false,
      }),
      Underline,
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      Markdown.configure({
        transformPastedText: true,
        transformCopiedText: true,
      }),
      GhostMark,
    ],
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
    <div className="h-full overflow-y-auto smooth-scroll">
      <EditorContent editor={editor} className="h-full" />
    </div>
  );
}
