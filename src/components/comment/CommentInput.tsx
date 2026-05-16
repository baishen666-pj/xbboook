import { useState } from "react";

interface Props {
  onSubmit: (content: string) => void;
  onCancel: () => void;
  initialContent?: string;
}

export function CommentInput({ onSubmit, onCancel, initialContent = "" }: Props) {
  const [content, setContent] = useState(initialContent);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    onSubmit(content.trim());
    setContent("");
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="输入批注内容..."
        className="w-full resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/80 outline-none focus:border-[oklch(0.65_0.18_250)]"
        rows={3}
        autoFocus
      />
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-3 py-1 text-[10px] text-white/40 hover:text-white/60"
        >
          取消
        </button>
        <button
          type="submit"
          disabled={!content.trim()}
          className="rounded-lg bg-[oklch(0.65_0.18_250)] px-3 py-1 text-[10px] text-white disabled:opacity-40"
        >
          提交
        </button>
      </div>
    </form>
  );
}
