import { useState, useCallback } from "react";
import { useAiStore } from "@/stores/aiStore";
import { useAiChat } from "@/hooks/useAiChat";

export function AiChatInput() {
  const [text, setText] = useState("");
  const isStreaming = useAiStore((s) => s.isStreaming);
  const activeSkillId = useAiStore((s) => s.activeSkillId);
  const { send } = useAiChat();

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = text.trim();
      if (!trimmed || isStreaming) return;
      send(trimmed);
      setText("");
    },
    [text, isStreaming, send]
  );

  const skillPlaceholders: Record<string, string> = {
    continue: "点击发送开始续写...",
    rewrite: "描述改写要求...",
    polish: "点击发送润色选中文本...",
    style: "输入目标风格（热血/暗黑/唯美...）",
    dialogue: "描述对话场景...",
    consistency: "点击发送检查一致性...",
    inspiration: "描述想要的情节方向...",
    qa: "输入你的问题...",
    deai: "点击发送对选中文本去AI味...",
  };

  return (
    <div className="border-t border-white/5 px-4 py-3">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={skillPlaceholders[activeSkillId] || "输入消息..."}
          disabled={isStreaming}
          className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-white/25 focus:outline-none focus:border-[var(--color-primary)]/50 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={isStreaming || !text.trim()}
          className="rounded-lg bg-[var(--color-primary)] px-3 py-2 text-sm text-white transition-colors hover:opacity-90 disabled:opacity-40 disabled:pointer-events-none"
        >
          {isStreaming ? (
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          ) : (
            "发送"
          )}
        </button>
      </form>
    </div>
  );
}
