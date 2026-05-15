import { create } from "zustand";
import type { CollabUser, OnlineUser, ChapterLock } from "@/types/project";

interface CollabState {
  currentUser: CollabUser | null;
  onlineUsers: OnlineUser[];
  locks: ChapterLock[];
  ws: WebSocket | null;

  setCurrentUser: (user: CollabUser) => void;
  setOnlineUsers: (users: OnlineUser[]) => void;
  setLocks: (locks: ChapterLock[]) => void;
  setWs: (ws: WebSocket | null) => void;
  addLock: (lock: ChapterLock) => void;
  removeLock: (chapterId: string) => void;
}

const STORED_KEY = "xbboook_user_id";

export function getStoredUserId(): string | null {
  return localStorage.getItem(STORED_KEY);
}

export function setStoredUserId(id: string): void {
  localStorage.setItem(STORED_KEY, id);
}

export const useCollabStore = create<CollabState>((set) => ({
  currentUser: null,
  onlineUsers: [],
  locks: [],
  ws: null,

  setCurrentUser: (user) => set({ currentUser: user }),
  setOnlineUsers: (users) => set({ onlineUsers: users }),
  setLocks: (locks) => set({ locks }),
  setWs: (ws) => set({ ws }),
  addLock: (lock) => set((s) => ({ locks: [...s.locks.filter((l) => l.chapterId !== lock.chapterId), lock] })),
  removeLock: (chapterId) => set((s) => ({ locks: s.locks.filter((l) => l.chapterId !== chapterId) })),
}));
