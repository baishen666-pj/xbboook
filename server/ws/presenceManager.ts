import type WebSocket from 'ws';
import { randomBytes } from 'crypto';

const tokenStore = new Map<string, { userId: string; createdAt: Date }>();

interface PresenceEntry {
  ws: WebSocket;
  userId: string;
  projectId: string;
  connectedAt: Date;
  lastActive: Date;
}

const presence = new Map<string, PresenceEntry[]>();
export { presence };

setInterval(() => {
  const now = Date.now();
  for (const [token, entry] of tokenStore) {
    if (now - entry.createdAt.getTime() > 24 * 60 * 60 * 1000) {
      tokenStore.delete(token);
    }
  }
}, 10 * 60 * 1000).unref?.();

export function generateToken(userId: string): string {
  const token = randomBytes(24).toString('hex');
  tokenStore.set(token, { userId, createdAt: new Date() });
  return token;
}

export function validateToken(token: string): string | null {
  const entry = tokenStore.get(token);
  if (!entry) return null;
  if (Date.now() - entry.createdAt.getTime() > 24 * 60 * 60 * 1000) {
    tokenStore.delete(token);
    return null;
  }
  return entry.userId;
}

export function addConnection(ws: WebSocket, userId: string, projectId: string): void {
  const existing = presence.get(userId) ?? [];
  existing.push({ ws, userId, projectId, connectedAt: new Date(), lastActive: new Date() });
  presence.set(userId, existing);
}

export function removeConnection(ws: WebSocket, userId: string, projectId: string): void {
  const entries = presence.get(userId);
  if (!entries) return;
  const filtered = entries.filter((e) => e.ws !== ws);
  if (filtered.length === 0) {
    presence.delete(userId);
  } else {
    presence.set(userId, filtered);
  }
}

export function getOnlineUsers(projectId: string): { userId: string; connectedAt: Date }[] {
  const users: { userId: string; connectedAt: Date }[] = [];
  const seen = new Set<string>();
  for (const entries of presence.values()) {
    for (const entry of entries) {
      if (entry.projectId === projectId && !seen.has(entry.userId)) {
        users.push({ userId: entry.userId, connectedAt: entry.connectedAt });
        seen.add(entry.userId);
      }
    }
  }
  return users;
}

export function broadcastToProject(projectId: string, message: object, excludeWs?: WebSocket): void {
  const data = JSON.stringify(message);
  for (const entries of presence.values()) {
    for (const entry of entries) {
      if (entry.projectId === projectId && entry.ws !== excludeWs && entry.ws.readyState === 1) {
        entry.ws.send(data);
      }
    }
  }
}
