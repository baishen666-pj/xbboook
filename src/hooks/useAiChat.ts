import { useCallback, useEffect, useRef } from "react";
import { useAiStore, type AiMessage } from "@/stores/aiStore";
import { useEditorStore } from "@/stores/editorStore";
import { useProjectStore } from "@/stores/projectStore";
import { streamAi, type StreamRequest, type HistoryMessage } from "@/services/aiService";
import { chatHistoryService } from "@/services/chatHistoryService";

function buildHistoryFromMessages(messages: AiMessage[]): HistoryMessage[] {
  return messages
    .filter((m) => !m.isStreaming && m.content.length > 0)
    .map((m) => ({
      role: m.role,
      content: m.content,
    }));
}

export function useAiChat() {
  const activeSkillId = useAiStore((s) => s.activeSkillId);
  const activeChapterId = useEditorStore((s) => s.activeChapterId);
  const selectedText = useEditorStore((s) => s.selectedText);
  const currentProject = useProjectStore((s) => s.currentProject);
  const abortRef = useRef<AbortController | null>(null);

  // Load chat history when project/chapter changes
  useEffect(() => {
    if (currentProject) {
      useAiStore.getState().loadHistory(currentProject.id, activeChapterId ?? undefined);
    }
  }, [currentProject?.id, activeChapterId]);

  const send = useCallback(
    async (userMessage: string, extra?: { outlineContent?: string; character1Id?: string; character2Id?: string }) => {
      if (!currentProject) return;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const ai = useAiStore.getState();
      ai.addMessage({ role: "user", content: userMessage, skillId: activeSkillId });

      const assistantId = ai.addMessage({
        role: "assistant",
        content: "",
        skillId: activeSkillId,
        isStreaming: true,
      });

      const historyMessages = buildHistoryFromMessages(ai.messages);

      ai.setStreaming(true);
      ai.clearStreamContent();
      ai.setError(null);

      const req: StreamRequest = {
        projectId: currentProject.id,
        skillId: activeSkillId,
        chapterId: activeChapterId ?? undefined,
        selectedText: selectedText || undefined,
        question: userMessage,
        outlineContent: extra?.outlineContent,
        historyMessages,
        character1Id: extra?.character1Id,
        character2Id: extra?.character2Id,
      };

      let responseContent = "";

      try {
        for await (const event of streamAi(req, controller.signal)) {
          if (controller.signal.aborted) break;
          const s = useAiStore.getState();
          if (event.type === "chunk") {
            responseContent += event.content;
            s.appendToMessage(assistantId, event.content);
            s.appendStreamContent(event.content);
          } else if (event.type === "done") {
            responseContent = event.content || responseContent;
            s.finalizeMessage(assistantId);
          }
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        const message = err instanceof Error ? err.message : "AI 请求失败";
        const s = useAiStore.getState();
        s.setError(message);
        s.finalizeMessage(assistantId);
      } finally {
        if (abortRef.current === controller) {
          const s = useAiStore.getState();
          s.setStreaming(false);
          s.clearStreamContent();
        }

        // Persist messages (fire-and-forget)
        const chapterId = activeChapterId ?? undefined;
        if (userMessage && responseContent) {
          chatHistoryService
            .saveMessages(currentProject.id, [
              { chapterId, role: "user", content: userMessage, skillId: activeSkillId },
              { chapterId, role: "assistant", content: responseContent, skillId: activeSkillId },
            ])
            .catch(() => {});
        }
      }
    },
    [currentProject, activeChapterId, selectedText, activeSkillId],
  );

  const quickAction = useCallback(
    async (skillId: string, extra?: { outlineContent?: string }) => {
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
        "chapter-generate": "根据大纲生成章节",
        "character-dialogue": "角色对话模拟",
        "style-analysis": "分析选中文本风格",
        "plot-suggest": "获取情节建议",
        "foreshadowing-track": "追踪伏笔线索",
        "style-profile": "分析写作风格档案",
        "voice-design": "生成角色语音特征",
      };

      const label = skillLabels[skillId] || skillId;
      await send(label, extra);
    },
    [currentProject, send],
  );

  return { send, quickAction };
}
