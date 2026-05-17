import type { Editor } from "@tiptap/react";
import { useEditorStore } from "@/stores/editorStore";

const ACTIONS: Array<{ label: string; action: (editor: Editor) => void; check?: (editor: Editor) => boolean }> = [
  { label: "B", action: (e) => e.chain().focus().toggleBold().run(), check: (e) => e.isActive("bold") },
  { label: "I", action: (e) => e.chain().focus().toggleItalic().run(), check: (e) => e.isActive("italic") },
  { label: "H1", action: (e) => e.chain().focus().toggleHeading({ level: 1 }).run(), check: (e) => e.isActive("heading", { level: 1 }) },
  { label: "H2", action: (e) => e.chain().focus().toggleHeading({ level: 2 }).run(), check: (e) => e.isActive("heading", { level: 2 }) },
  { label: "「」", action: (e) => e.chain().focus().toggleBlockquote().run(), check: (e) => e.isActive("blockquote") },
  { label: "·", action: (e) => e.chain().focus().toggleBulletList().run(), check: (e) => e.isActive("bulletList") },
];

export function MobileToolbar() {
  const editor = useEditorStore((s) => s.editorInstance);
  if (!editor) return null;

  return (
    <div className="md:hidden fixed bottom-14 left-0 right-0 z-30 flex items-center justify-center gap-1 border-t border-[var(--color-border)] bg-[var(--color-surface-1)] px-2 py-1 safe-area-inset-bottom">
      {ACTIONS.map((item) => {
        const active = item.check?.(editor) ?? false;
        return (
          <button
            key={item.label}
            type="button"
            onClick={() => item.action(editor)}
            className={[
              "flex h-9 min-w-[36px] items-center justify-center rounded-md px-2 text-xs font-medium transition-colors touch-target",
              active
                ? "bg-[var(--color-primary)]/15 text-[var(--color-primary)]"
                : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-3)]",
            ].join(" ")}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
