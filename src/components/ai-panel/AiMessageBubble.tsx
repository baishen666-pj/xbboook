import { memo, useState } from "react";
import type { AiMessage } from "@/stores/aiStore";
import { useEditorStore } from "@/stores/editorStore";
import { useProjectStore } from "@/stores/projectStore";
import { versionService } from "@/services/versionService";
import { ConsistencyReport } from "./ConsistencyReport";

interface Props {
  message: AiMessage;
}

export const AiMessageBubble = memo(function AiMessageBubble({ message }: Props) {
  const isUser = message.role === "user";
  const editor = useEditorStore((s) => s.editorInstance);
  const activeChapterId = useEditorStore((s) => s.activeChapterId);
  const currentProject = useProjectStore((s) => s.currentProject);
  const [inserted, setInserted] = useState(false);

  const canInsert = !isUser && !message.isStreaming && editor && activeChapterId && message.content
    && message.skillId !== "consistency-scan";

  const isConsistencyReport = !isUser && message.skillId === "consistency-scan" && !message.isStreaming;

  const handleInsert = async () => {
    if (!editor || !message.content || !activeChapterId || !currentProject) return;
    try {
      const res = await versionService.create(currentProject.id, activeChapterId, { label: "AI编辑前快照" });
      if (res.success && res.data) {
        useEditorStore.getState().setAiEditSnapshot(res.data.id);
      }
    } catch { /* snapshot creation is best-effort */ }
    const html = message.content
      .split("\n")
      .filter(Boolean)
      .map((p) => `<p><span class="ghost-text">${p}</span></p>`)
      .join("");
    editor.chain().focus().insertContent(html).run();
    setInserted(true);
    setTimeout(() => setInserted(false), 2000);
  };

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
          isUser
            ? "bg-[var(--color-primary)] text-white rounded-br-sm"
            : "bg-white/5 text-[var(--color-text-primary)] rounded-bl-sm"
        }`}
      >
        {isConsistencyReport ? (
          <ConsistencyReport content={message.content} />
        ) : (
          <p className="whitespace-pre-wrap">{message.content || (message.isStreaming ? "..." : "")}</p>
        )}
        {message.isStreaming && (
          <span className="inline-block w-1.5 h-4 bg-[var(--color-primary)] animate-pulse ml-0.5 align-middle" />
        )}
        {canInsert && (
          <div className="mt-2 pt-2 border-t border-white/5">
            <button
              onClick={handleInsert}
              disabled={inserted}
              className={`flex items-center gap-1 text-xs rounded px-2 py-0.5 transition-colors ${
                inserted
                  ? "text-emerald-400 bg-emerald-500/10"
                  : "text-white/40 hover:text-white/70 hover:bg-white/5"
              }`}
            >
              {inserted ? (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  已插入
                </>
              ) : (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  插入编辑器
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
});
