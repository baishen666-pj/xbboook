import { useState, useCallback } from "react";
import { useAiStore } from "@/stores/aiStore";
import { useAiChat } from "@/hooks/useAiChat";

export function AiChatInput() {
  const [text, setText] = useState("");
  const isStreaming = useAiStore((s) => s.isStreaming);
  const activeSkillId = useAiStore((s) => s.activeSkillId);
  const hasMessages = useAiStore((s) => s.messages.length > 0);
  const clearMessages = useAiStore((s) => s.clearMessages);
  const dialogueCharacter1Id = useAiStore((s) => s.dialogueCharacter1Id);
  const dialogueCharacter2Id = useAiStore((s) => s.dialogueCharacter2Id);
  const { send } = useAiChat();

  const isCharacterDialogue = activeSkillId === "character-dialogue";
  const charactersReady = isCharacterDialogue
    ? !!dialogueCharacter1Id && !!dialogueCharacter2Id
    : true;

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = text.trim();
      if (!trimmed || isStreaming) return;
      if (isCharacterDialogue && !charactersReady) return;
      send(trimmed, {
        character1Id: dialogueCharacter1Id ?? undefined,
        character2Id: dialogueCharacter2Id ?? undefined,
      });
      setText("");
    },
    [text, isStreaming, send, isCharacterDialogue, charactersReady, dialogueCharacter1Id, dialogueCharacter2Id],
  );

  const handleNewConversation = useCallback(() => {
    clearMessages();
  }, [clearMessages]);

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
    "character-dialogue": "描述对话场景或直接发送...",
    "style-analysis": "选中要分析风格的文本后点击发送...",
    "plot-suggest": "描述想要的情节方向，或直接发送获取建议...",
    "foreshadowing-track": "点击发送扫描当前章节的伏笔...",
  };

  const placeholder = isCharacterDialogue && !charactersReady
    ? "请先选择两个角色..."
    : (skillPlaceholders[activeSkillId] || "输入消息...");

  return (
    <div className="border-t border-white/5 px-4 py-3">
      <form onSubmit={handleSubmit} className="flex gap-2">
        {hasMessages && (
          <button
            type="button"
            onClick={handleNewConversation}
            disabled={isStreaming}
            className="shrink-0 rounded-lg border border-white/10 px-2 py-2 text-xs text-white/40 transition-colors hover:text-white/70 hover:border-white/20 disabled:opacity-40"
            title="清空对话，开始新话题"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
          </button>
        )}
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          disabled={isStreaming || (isCharacterDialogue && !charactersReady)}
          className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-white/25 focus:outline-none focus:border-[var(--color-primary)]/50 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={isStreaming || !text.trim() || (isCharacterDialogue && !charactersReady)}
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
