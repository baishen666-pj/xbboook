import { memo } from "react";
import type { AiMessage } from "@/stores/aiStore";

interface Props {
  message: AiMessage;
}

export const AiMessageBubble = memo(function AiMessageBubble({ message }: Props) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
          isUser
            ? "bg-[var(--color-primary)] text-white rounded-br-sm"
            : "bg-white/5 text-[var(--color-text-primary)] rounded-bl-sm"
        }`}
      >
        <p className="whitespace-pre-wrap">{message.content || (message.isStreaming ? "..." : "")}</p>
        {message.isStreaming && (
          <span className="inline-block w-1.5 h-4 bg-[var(--color-primary)] animate-pulse ml-0.5 align-middle" />
        )}
      </div>
    </div>
  );
});
