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
}

let msgCounter = 0;

export const useAiStore = create<AiState & AiActions>((set) => ({
  isOpen: false,
  skills: [],
  activeSkillId: "continue",
  messages: [],
  isStreaming: false,
  currentStreamContent: "",
  error: null,

  togglePanel: () => set((s) => ({ isOpen: !s.isOpen })),
  openPanel: () => set({ isOpen: true }),
  closePanel: () => set({ isOpen: false }),

  setSkills: (skills) => set({ skills }),
  setActiveSkill: (skillId) => set({ activeSkillId: skillId }),

  addMessage: (msg) => {
    const id = `msg-${++msgCounter}`;
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
}));
