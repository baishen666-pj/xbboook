import type { ChapterComment } from "@/types/project";

interface Props {
  comment: ChapterComment;
  onResolve: () => void;
  onDelete: () => void;
}

export function CommentBubble({ comment, onResolve, onDelete }: Props) {
  const isResolved = comment.resolved === 1;

  return (
    <div className={`rounded-lg border p-3 space-y-2 ${isResolved ? "border-white/5 bg-white/[0.02] opacity-50" : "border-white/10 bg-white/[0.03]"}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="h-4 w-4 rounded-full flex items-center justify-center text-[7px] font-bold text-white"
            style={{ backgroundColor: comment.avatarColor }}
          >
            {comment.displayName.charAt(0)}
          </div>
          <span className="text-[10px] text-white/50">{comment.displayName}</span>
          <span className="text-[9px] text-white/20">{new Date(comment.createdAt).toLocaleDateString()}</span>
        </div>
        <div className="flex items-center gap-1">
          {!isResolved && (
            <button onClick={onResolve} className="text-[9px] text-white/30 hover:text-green-400" title="标记已解决">✓</button>
          )}
          <button onClick={onDelete} className="text-[9px] text-white/30 hover:text-red-400" title="删除">×</button>
        </div>
      </div>

      {comment.selectionText && (
        <div className="rounded bg-[oklch(0.65_0.18_250)]/10 px-2 py-1 text-[10px] text-[oklch(0.7_0.15_250)] italic truncate">
          "{comment.selectionText}"
        </div>
      )}

      <p className="text-xs text-white/70 leading-relaxed">{comment.content}</p>

      {isResolved && (
        <span className="text-[9px] text-green-400/50">已解决</span>
      )}
    </div>
  );
}
