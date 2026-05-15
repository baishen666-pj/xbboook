import { useCallback } from "react";
import { useAiStore } from "@/stores/aiStore";
import { useEditorStore } from "@/stores/editorStore";
import { useProjectStore } from "@/stores/projectStore";
import { streamAi, type StreamRequest } from "@/services/aiService";

export function useAiChat() {
  const { activeSkillId, addMessage, appendToMessage, finalizeMessage, setStreaming, appendStreamContent, clearStreamContent, setError } = useAiStore();
  const { activeChapterId, selectedText } = useEditorStore();
  const currentProject = useProjectStore((s) => s.currentProject);

  const send = useCallback(
    async (userMessage: string) => {
      if (!currentProject) return;

      addMessage({ role: "user", content: userMessage, skillId: activeSkillId });

      const assistantId = addMessage({
        role: "assistant",
        content: "",
        skillId: activeSkillId,
        isStreaming: true,
      });

      setStreaming(true);
      clearStreamContent();
      setError(null);

      const req: StreamRequest = {
        projectId: currentProject.id,
        skillId: activeSkillId,
        chapterId: activeChapterId ?? undefined,
        selectedText: selectedText || undefined,
        question: userMessage,
      };

      try {
        for await (const event of streamAi(req)) {
          if (event.type === "chunk") {
            appendToMessage(assistantId, event.content);
            appendStreamContent(event.content);
          } else if (event.type === "done") {
            finalizeMessage(assistantId);
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "AI request failed";
        setError(message);
        finalizeMessage(assistantId);
      } finally {
        setStreaming(false);
        clearStreamContent();
      }
    },
    [currentProject, activeChapterId, selectedText, activeSkillId, addMessage, appendToMessage, finalizeMessage, setStreaming, appendStreamContent, clearStreamContent, setError]
  );

  const quickAction = useCallback(
    async (skillId: string) => {
      if (!currentProject) return;

      useAiStore.getState().setActiveSkill(skillId);

      const skillLabels: Record<string, string> = {
        continue: "续写",
        rewrite: "改写选中文本",
        polish: "润色选中文本",
        style: "风格转换",
        dialogue: "生成对话",
        consistency: "检查一致性",
        inspiration: "获取灵感",
        qa: "写作问答",
        deai: "对选中文本去AI味",
      };

      const label = skillLabels[skillId] || skillId;
      await send(label);
    },
    [currentProject, send]
  );

  return { send, quickAction };
}
