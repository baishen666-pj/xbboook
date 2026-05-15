import type WebSocket from 'ws';

interface PresenceEntry {
  ws: WebSocket;
  userId: string;
  projectId: string;
  connectedAt: Date;
}

const presence = new Map<string, PresenceEntry>();

export function addConnection(ws: WebSocket, userId: string, projectId: string): void {
  presence.set(userId, { ws, userId, projectId, connectedAt: new Date() });
}

export function removeConnection(userId: string): void {
  presence.delete(userId);
}

export function getOnlineUsers(projectId: string): { userId: string; connectedAt: Date }[] {
  const users: { userId: string; connectedAt: Date }[] = [];
  for (const entry of presence.values()) {
    if (entry.projectId === projectId) {
      users.push({ userId: entry.userId, connectedAt: entry.connectedAt });
    }
  }
  return users;
}

export function broadcastToProject(projectId: string, message: object, excludeUserId?: string): void {
  const data = JSON.stringify(message);
  for (const entry of presence.values()) {
    if (entry.projectId === projectId && entry.userId !== excludeUserId && entry.ws.readyState === 1) {
      entry.ws.send(data);
    }
  }
}

export function getConnection(userId: string): PresenceEntry | undefined {
  return presence.get(userId);
}
