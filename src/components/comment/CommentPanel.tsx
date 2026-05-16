import { useEffect, useState } from "react";
import { useEditorStore } from "@/stores/editorStore";
import { useProjectStore } from "@/stores/projectStore";
import { useCollabStore } from "@/stores/collabStore";
import { useCommentStore } from "@/stores/commentStore";
import { CommentBubble } from "./CommentBubble";
import { CommentInput } from "./CommentInput";

export function CommentPanel() {
  const activeChapterId = useEditorStore((s) => s.activeChapterId);
  const currentProject = useProjectStore((s) => s.currentProject);
  const currentUser = useCollabStore((s) => s.currentUser);
  const { comments, fetchComments, addComment, resolveComment, removeComment } = useCommentStore();
  const [showInput, setShowInput] = useState(false);
  const [filter, setFilter] = useState<"all" | "open" | "resolved">("all");

  useEffect(() => {
    if (currentProject && activeChapterId) {
      fetchComments(currentProject.id, activeChapterId);
    }
  }, [currentProject, activeChapterId, fetchComments]);

  if (!activeChapterId) {
    return <div className="p-4 text-center text-xs text-white/20">请先选择章节</div>;
  }

  const filtered = filter === "all"
    ? comments
    : filter === "open"
      ? comments.filter((c) => c.resolved === 0)
      : comments.filter((c) => c.resolved === 1);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-white/5 px-3 py-2">
        <span className="text-xs font-medium text-white/60">批注 ({comments.length})</span>
        <div className="flex gap-1">
          {(["all", "open", "resolved"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded px-1.5 py-0.5 text-[9px] ${filter === f ? "bg-white/10 text-white/60" : "text-white/25"}`}
            >
              {f === "all" ? "全部" : f === "open" ? "待处理" : "已解决"}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {filtered.map((comment) => (
          <CommentBubble
            key={comment.id}
            comment={comment}
            onResolve={() => {
              if (currentProject) resolveComment(currentProject.id, activeChapterId, comment.id);
            }}
            onDelete={() => {
              if (currentProject) removeComment(currentProject.id, activeChapterId, comment.id);
            }}
          />
        ))}
        {filtered.length === 0 && (
          <div className="py-8 text-center text-[10px] text-white/15">暂无批注</div>
        )}
      </div>

      <div className="border-t border-white/5 p-3">
        {showInput ? (
          <CommentInput
            onSubmit={(content) => {
              if (currentProject && currentUser) {
                addComment(currentProject.id, activeChapterId, {
                  content,
                  userId: currentUser.id,
                });
              }
              setShowInput(false);
            }}
            onCancel={() => setShowInput(false)}
          />
        ) : (
          <button
            onClick={() => setShowInput(true)}
            className="w-full rounded-lg border border-dashed border-white/10 py-2 text-[10px] text-white/30 hover:border-white/20 hover:text-white/50 transition-colors"
          >
            + 添加批注
          </button>
        )}
      </div>
    </div>
  );
}
