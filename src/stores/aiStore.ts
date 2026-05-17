import { create } from "zustand";
import type { AiSkill } from "@/services/aiService";

export interface AiMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  skillId: string;
  timestamp: number;
  isStreaming?: boolean;
}

interface AiState {
  isOpen: boolean;
  skills: AiSkill[];
  activeSkillId: string;
  messages: AiMessage[];
  isStreaming: boolean;
  currentStreamContent: string;
  error: string | null;
  dialogueCharacter1Id: string | null;
  dialogueCharacter2Id: string | null;
}

interface AiActions {
  togglePanel: () => void;
  openPanel: () => void;
  closePanel: () => void;
  setSkills: (skills: AiSkill[]) => void;
  setActiveSkill: (skillId: string) => void;
  addMessage: (msg: Omit<AiMessage, "id" | "timestamp">) => string;
  appendToMessage: (id: string, content: string) => void;
  finalizeMessage: (id: string) => void;
  setStreaming: (streaming: boolean) => void;
  setCurrentStreamContent: (content: string) => void;
  appendStreamContent: (chunk: string) => void;
  clearStreamContent: () => void;
  setError: (error: string | null) => void;
  clearMessages: () => void;
  setDialogueCharacter1: (id: string | null) => void;
  setDialogueCharacter2: (id: string | null) => void;
  loadHistory: (projectId: string, chapterId?: string) => Promise<void>;
}

function nextMsgId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const useAiStore = create<AiState & AiActions>((set) => ({
  isOpen: false,
  skills: [],
  activeSkillId: "continue",
  messages: [],
  isStreaming: false,
  currentStreamContent: "",
  error: null,
  dialogueCharacter1Id: null,
  dialogueCharacter2Id: null,

  togglePanel: () => set((s) => ({ isOpen: !s.isOpen })),
  openPanel: () => set({ isOpen: true }),
  closePanel: () => set({ isOpen: false }),

  setSkills: (skills) => set({ skills }),
  setActiveSkill: (skillId) => set({ activeSkillId: skillId }),

  addMessage: (msg) => {
    const id = nextMsgId();
    set((s) => ({
      messages: [...s.messages, { ...msg, id, timestamp: Date.now() }],
    }));
    return id;
  },

  appendToMessage: (id, content) =>
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === id ? { ...m, content: m.content + content } : m
      ),
    })),

  finalizeMessage: (id) =>
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === id ? { ...m, isStreaming: false } : m
      ),
    })),

  setStreaming: (streaming) => set({ isStreaming: streaming }),
  setCurrentStreamContent: (content) => set({ currentStreamContent: content }),
  appendStreamContent: (chunk) =>
    set((s) => ({ currentStreamContent: s.currentStreamContent + chunk })),
  clearStreamContent: () => set({ currentStreamContent: "" }),
  setError: (error) => set({ error }),
  clearMessages: () => set({ messages: [], currentStreamContent: "" }),
  setDialogueCharacter1: (id) => set({ dialogueCharacter1Id: id }),
  setDialogueCharacter2: (id) => set({ dialogueCharacter2Id: id }),

  loadHistory: async (projectId, chapterId) => {
    const { chatHistoryService } = await import("@/services/chatHistoryService");
    const messages = await chatHistoryService.getHistory(projectId, chapterId);
    set({
      messages: messages.map((m) => ({
        id: m.id,
        role: m.role as "user" | "assistant",
        content: m.content,
        skillId: m.skillId,
        timestamp: new Date(m.createdAt).getTime(),
      })),
    });
  },
}));
