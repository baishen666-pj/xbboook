import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/services/apiClient', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import { collabService, createCollabWs, type WsMessage } from '@/services/collabService';
import { apiClient } from '@/services/apiClient';

describe('collabService (client)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('identify', () => {
    it('calls POST /users/identify', async () => {
      const mockUser = { id: 'u1', username: 'alice', displayName: 'Alice', avatarColor: '#6366f1' };
      vi.mocked(apiClient.post).mockResolvedValue({ success: true, data: mockUser, error: null });

      const result = await collabService.identify({ username: 'alice', displayName: 'Alice' });

      expect(apiClient.post).toHaveBeenCalledWith('/users/identify', {
        username: 'alice', displayName: 'Alice',
      });
      expect(result.data).toEqual(mockUser);
    });

    it('passes avatarColor when provided', async () => {
      vi.mocked(apiClient.post).mockResolvedValue({ success: true, data: null, error: null });

      await collabService.identify({ username: 'alice', displayName: 'Alice', avatarColor: '#ec4899' });

      expect(apiClient.post).toHaveBeenCalledWith('/users/identify', expect.objectContaining({ avatarColor: '#ec4899' }));
    });
  });

  describe('getMe', () => {
    it('calls GET /users/me with userId query param', async () => {
      const mockUser = { id: 'u1', username: 'alice', displayName: 'Alice', avatarColor: '#6366f1' };
      vi.mocked(apiClient.get).mockResolvedValue({ success: true, data: mockUser, error: null });

      const result = await collabService.getMe('u1');

      expect(apiClient.get).toHaveBeenCalledWith('/users/me?userId=u1');
      expect(result.data).toEqual(mockUser);
    });
  });

  describe('getOnlineUsers', () => {
    it('calls GET /projects/:id/collab/online', async () => {
      const mockUsers = [{ userId: 'u1', displayName: 'Alice', avatarColor: '#6366f1' }];
      vi.mocked(apiClient.get).mockResolvedValue({ success: true, data: mockUsers, error: null });

      const result = await collabService.getOnlineUsers('proj-1');

      expect(apiClient.get).toHaveBeenCalledWith('/projects/proj-1/collab/online');
      expect(result.data).toEqual(mockUsers);
    });
  });

  describe('getMembers', () => {
    it('calls GET /projects/:id/collab/members', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ success: true, data: [], error: null });

      const result = await collabService.getMembers('proj-1');

      expect(apiClient.get).toHaveBeenCalledWith('/projects/proj-1/collab/members');
      expect(result.data).toEqual([]);
    });
  });

  describe('addMember', () => {
    it('calls POST /projects/:id/collab/members with userId', async () => {
      vi.mocked(apiClient.post).mockResolvedValue({ success: true, data: { projectId: 'proj-1', userId: 'u1' }, error: null });

      const result = await collabService.addMember('proj-1', 'u1');

      expect(apiClient.post).toHaveBeenCalledWith('/projects/proj-1/collab/members', { userId: 'u1' });
      expect(result.data!.userId).toBe('u1');
    });
  });

  describe('acquireLock', () => {
    it('calls POST /projects/:id/collab/lock/:chapterId with userId', async () => {
      vi.mocked(apiClient.post).mockResolvedValue({ success: true, data: { chapterId: 'ch1', userId: 'u1' }, error: null });

      const result = await collabService.acquireLock('proj-1', 'ch1', 'u1');

      expect(apiClient.post).toHaveBeenCalledWith('/projects/proj-1/collab/lock/ch1', { userId: 'u1' });
      expect(result.data!.chapterId).toBe('ch1');
    });
  });

  describe('releaseLock', () => {
    it('calls DELETE /projects/:id/collab/lock/:chapterId with userId query', async () => {
      vi.mocked(apiClient.delete).mockResolvedValue({ success: true, data: null, error: null });

      await collabService.releaseLock('proj-1', 'ch1', 'u1');

      expect(apiClient.delete).toHaveBeenCalledWith('/projects/proj-1/collab/lock/ch1?userId=u1');
    });
  });

  describe('getLocks', () => {
    it('calls GET /projects/:id/collab/locks', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ success: true, data: [], error: null });

      const result = await collabService.getLocks('proj-1');

      expect(apiClient.get).toHaveBeenCalledWith('/projects/proj-1/collab/locks');
      expect(result.data).toEqual([]);
    });
  });
});

describe('createCollabWs', () => {
  const originalWebSocket = (globalThis as any).WebSocket;

  beforeEach(() => {
    // Provide global window mock for Node environment
    (globalThis as any).window = { location: { protocol: 'http:', host: 'localhost:5210' } };
  });

  afterEach(() => {
    (globalThis as any).WebSocket = originalWebSocket;
    (globalThis as any).window = undefined;
  });

  it('creates WebSocket with correct protocol (ws:)', () => {
    const captured: string[] = [];
    const mockWs = { close: vi.fn() };
    function WsMock(this: any, url: string) {
      captured.push(url);
      return mockWs;
    }
    (globalThis as any).WebSocket = WsMock;

    (globalThis as any).window = { location: { protocol: 'http:', host: 'localhost:5210' } };

    const ws = createCollabWs();

    expect(captured[0]).toBe('ws://localhost:5210/ws');
    expect(ws).toBe(mockWs);
  });

  it('creates WebSocket with wss: for https', () => {
    const captured: string[] = [];
    const mockWs = { close: vi.fn() };
    function WsMock(this: any, url: string) {
      captured.push(url);
      return mockWs;
    }
    (globalThis as any).WebSocket = WsMock;

    (globalThis as any).window = { location: { protocol: 'https:', host: 'example.com' } };

    createCollabWs();

    expect(captured[0]).toBe('wss://example.com/ws');
  });

  it('returns null on WebSocket construction error', () => {
    function WsMock(this: any) {
      throw new Error('WebSocket not available');
    }
    (globalThis as any).WebSocket = WsMock;

    const ws = createCollabWs();
    expect(ws).toBeNull();
  });
});
