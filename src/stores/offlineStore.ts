import { create } from "zustand";

interface OfflineState {
  isOnline: boolean;
  pendingCount: number;
  isReplaying: boolean;
}

interface OfflineActions {
  setOnline: (online: boolean) => void;
  setPendingCount: (count: number) => void;
  setReplaying: (replaying: boolean) => void;
}

export const useOfflineStore = create<OfflineState & OfflineActions>((set) => ({
  isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
  pendingCount: 0,
  isReplaying: false,
  setOnline: (online) => set({ isOnline: online }),
  setPendingCount: (count) => set({ pendingCount: count }),
  setReplaying: (replaying) => set({ isReplaying: replaying }),
}));
