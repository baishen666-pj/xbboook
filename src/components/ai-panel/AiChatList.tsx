import { useRef, useEffect } from "react";
import { useAiStore } from "@/stores/aiStore";
import { AiMessageBubble } from "./AiMessageBubble";

export function AiChatList() {
  const messages = useAiStore((s) => s.messages);
  const error = useAiStore((s) => s.error);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
      {messages.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-white/20 text-sm">
          <div className="text-3xl mb-3">✦</div>
          <p>选择一个技能开始创作</p>
          <p className="text-xs mt-1">或选中文本后右键使用 AI 操作</p>
        </div>
      )}

      {messages.map((msg) => (
        <AiMessageBubble key={msg.id} message={msg} />
      ))}

      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-sm text-red-400">
          {error}
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
