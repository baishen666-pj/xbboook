import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
  };
})();

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });

import { useCollabStore, getStoredUserId, setStoredUserId } from '@/stores/collabStore';

describe('collabStore', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
    useCollabStore.setState({
      currentUser: null,
      onlineUsers: [],
      locks: [],
      ws: null,
    });
  });

  describe('setCurrentUser', () => {
    it('sets the current user', () => {
      const user = { id: 'u1', username: 'alice', displayName: 'Alice', avatarColor: '#6366f1' };
      useCollabStore.getState().setCurrentUser(user);

      expect(useCollabStore.getState().currentUser).toEqual(user);
    });
  });

  describe('setOnlineUsers', () => {
    it('sets online users list', () => {
      const users = [
        { userId: 'u1', displayName: 'Alice', avatarColor: '#6366f1' },
        { userId: 'u2', displayName: 'Bob', avatarColor: '#ec4899' },
      ];
      useCollabStore.getState().setOnlineUsers(users);

      expect(useCollabStore.getState().onlineUsers).toEqual(users);
    });

    it('replaces existing online users', () => {
      useCollabStore.getState().setOnlineUsers([{ userId: 'u1', displayName: 'A', avatarColor: '#000' }]);
      useCollabStore.getState().setOnlineUsers([{ userId: 'u2', displayName: 'B', avatarColor: '#000' }]);

      expect(useCollabStore.getState().onlineUsers).toHaveLength(1);
      expect(useCollabStore.getState().onlineUsers[0].userId).toBe('u2');
    });
  });

  describe('setLocks', () => {
    it('sets locks list', () => {
      const locks = [{ chapterId: 'ch1', userId: 'u1', displayName: 'Alice', lockedAt: '2026-01-01' }];
      useCollabStore.getState().setLocks(locks);

      expect(useCollabStore.getState().locks).toEqual(locks);
    });
  });

  describe('setWs', () => {
    it('sets WebSocket connection', () => {
      const mockWs = { close: vi.fn() } as unknown as WebSocket;
      useCollabStore.getState().setWs(mockWs);

      expect(useCollabStore.getState().ws).toBe(mockWs);
    });

    it('can clear WebSocket by setting null', () => {
      const mockWs = { close: vi.fn() } as unknown as WebSocket;
      useCollabStore.getState().setWs(mockWs);
      useCollabStore.getState().setWs(null);

      expect(useCollabStore.getState().ws).toBeNull();
    });
  });

  describe('addLock', () => {
    it('adds a new lock', () => {
      const lock = { chapterId: 'ch1', userId: 'u1', displayName: 'Alice', lockedAt: '2026-01-01' };
      useCollabStore.getState().addLock(lock);

      expect(useCollabStore.getState().locks).toHaveLength(1);
      expect(useCollabStore.getState().locks[0]).toEqual(lock);
    });

    it('replaces existing lock for same chapter', () => {
      useCollabStore.getState().addLock({ chapterId: 'ch1', userId: 'u1', displayName: 'Alice', lockedAt: '2026-01-01' });
      useCollabStore.getState().addLock({ chapterId: 'ch1', userId: 'u2', displayName: 'Bob', lockedAt: '2026-01-02' });

      expect(useCollabStore.getState().locks).toHaveLength(1);
      expect(useCollabStore.getState().locks[0].userId).toBe('u2');
      expect(useCollabStore.getState().locks[0].lockedAt).toBe('2026-01-02');
    });

    it('handles multiple different chapter locks', () => {
      useCollabStore.getState().addLock({ chapterId: 'ch1', userId: 'u1', displayName: 'A', lockedAt: '2026-01-01' });
      useCollabStore.getState().addLock({ chapterId: 'ch2', userId: 'u2', displayName: 'B', lockedAt: '2026-01-01' });

      expect(useCollabStore.getState().locks).toHaveLength(2);
    });
  });

  describe('removeLock', () => {
    it('removes lock by chapterId', () => {
      useCollabStore.getState().addLock({ chapterId: 'ch1', userId: 'u1', displayName: 'A', lockedAt: '2026-01-01' });
      useCollabStore.getState().addLock({ chapterId: 'ch2', userId: 'u2', displayName: 'B', lockedAt: '2026-01-01' });

      useCollabStore.getState().removeLock('ch1');

      expect(useCollabStore.getState().locks).toHaveLength(1);
      expect(useCollabStore.getState().locks[0].chapterId).toBe('ch2');
    });

    it('does nothing when lock does not exist', () => {
      useCollabStore.getState().addLock({ chapterId: 'ch1', userId: 'u1', displayName: 'A', lockedAt: '2026-01-01' });
      useCollabStore.getState().removeLock('ch999');

      expect(useCollabStore.getState().locks).toHaveLength(1);
    });
  });

  describe('getStoredUserId', () => {
    it('returns stored user id', () => {
      localStorageMock.setItem('xbboook_user_id', 'u1');

      const id = getStoredUserId();

      expect(id).toBe('u1');
      expect(localStorageMock.getItem).toHaveBeenCalledWith('xbboook_user_id');
    });

    it('returns null when not stored', () => {
      const id = getStoredUserId();
      expect(id).toBeNull();
    });
  });

  describe('setStoredUserId', () => {
    it('stores user id in localStorage', () => {
      setStoredUserId('u1');

      expect(localStorageMock.setItem).toHaveBeenCalledWith('xbboook_user_id', 'u1');
    });
  });
});
