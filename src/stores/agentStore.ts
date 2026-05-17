import { create } from 'zustand';

interface SessionState {
  id: string | null;
  status: string;
  iteration: number;
  maxIterations: number;
  currentStep: string;
  draftPreview: string;
  planPreview: string;
  reviewScore: number;
  reviewPassed: boolean;
  logs: Array<{ time: number; type: string; message: string }>;
  isRunning: boolean;
}

interface AgentState {
  activeSession: SessionState;
  isRunning: boolean;
}

const defaultSession: SessionState = {
  id: null,
  status: 'idle',
  iteration: 0,
  maxIterations: 3,
  currentStep: '',
  draftPreview: '',
  planPreview: '',
  reviewScore: 0,
  reviewPassed: false,
  logs: [],
  isRunning: false,
};

export const useAgentStore = create<AgentState & {
  setActiveSession: (id: string | null) => void;
  updateSession: (patch: Partial<SessionState>) => void;
  addLog: (type: string, message: string) => void;
  setRunning: (running: boolean) => void;
  reset: () => void;
}>((set) => ({
  activeSession: { ...defaultSession },
  isRunning: false,

  setActiveSession: (id) =>
    set((state) => ({
      activeSession: { ...state.activeSession, id },
    })),

  updateSession: (patch) =>
    set((state) => ({
      activeSession: { ...state.activeSession, ...patch },
    })),

  addLog: (type, message) =>
    set((state) => ({
      activeSession: {
        ...state.activeSession,
        logs: [...state.activeSession.logs, { time: Date.now(), type, message }].slice(-100),
      },
    })),

  setRunning: (running) => set({ isRunning: running }),

  reset: () => set({ activeSession: { ...defaultSession }, isRunning: false }),
}));
