import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import * as presenceManager from './presenceManager.js';
import * as userRepo from '../db/repositories/userRepo.js';

interface WsMessage {
  type: string;
  payload: Record<string, unknown>;
}

function buildOnlinePayload(projectId: string) {
  const online = presenceManager.getOnlineUsers(projectId);
  return online.map((u) => {
    const user = userRepo.findById(u.userId);
    return { userId: u.userId, displayName: user?.display_name ?? '未知', avatarColor: user?.avatar_color ?? '#6366f1' };
  });
}

const ALLOWED_ORIGINS = new Set([
  'http://localhost:5210',
  'http://localhost:3210',
  'http://127.0.0.1:5210',
  'http://127.0.0.1:3210',
]);

export function createWsServer(server: Server, corsOrigin?: string): WebSocketServer {
  if (corsOrigin) {
    ALLOWED_ORIGINS.add(corsOrigin);
  }

  const wss = new WebSocketServer({
    server,
    path: '/ws',
    maxPayload: 1024 * 64,
    verifyClient: (info, callback) => {
      const origin = info.req.headers.origin;
      if (!origin || ALLOWED_ORIGINS.has(origin)) {
        callback(true);
      } else {
        callback(false, 403, 'Forbidden origin');
      }
    },
  });

  const heartbeatInterval = setInterval(() => {
    const now = Date.now();
    for (const entries of presenceManager.getAllPresenceEntries()) {
      for (const entry of entries) {
        if (now - entry.lastActive.getTime() > 60_000 && entry.ws.readyState === 1) {
          entry.ws.terminate();
        }
      }
    }
  }, 30_000);
  heartbeatInterval.unref?.();

  wss.on('close', () => {
    clearInterval(heartbeatInterval);
  });

  wss.on('connection', (ws: WebSocket) => {
    let userId: string | null = null;
    let projectId: string | null = null;

    ws.on('message', (raw: Buffer) => {
      let msg: WsMessage;
      try {
        msg = JSON.parse(raw.toString()) as WsMessage;
      } catch {
        ws.send(JSON.stringify({ type: 'error', payload: { message: 'Invalid JSON' } }));
        return;
      }

      switch (msg.type) {
        case 'join': {
          const token = msg.payload.token as string;
          if (!token) {
            ws.send(JSON.stringify({ type: 'error', payload: { message: 'Missing token' } }));
            return;
          }
          const validatedUserId = presenceManager.validateToken(token);
          if (!validatedUserId) {
            ws.send(JSON.stringify({ type: 'error', payload: { message: 'Invalid or expired token' } }));
            return;
          }
          const pId = msg.payload.projectId as string;
          if (!pId) {
            ws.send(JSON.stringify({ type: 'error', payload: { message: 'Missing projectId' } }));
            return;
          }
          userId = validatedUserId;
          projectId = pId;

          presenceManager.addConnection(ws, userId, projectId);
          presenceManager.broadcastToProject(projectId, {
            type: 'presence:update',
            payload: { online: buildOnlinePayload(projectId) },
          }, ws);
          ws.send(JSON.stringify({ type: 'joined', payload: { projectId } }));
          break;
        }
        case 'ping': {
          ws.send(JSON.stringify({ type: 'pong', payload: {} }));
          if (userId && projectId) {
            const entry = presenceManager.findEntryByWs(userId, ws);
            if (entry) entry.lastActive = new Date();
          }
          break;
        }
        default:
          ws.send(JSON.stringify({ type: 'error', payload: { message: `Unknown type: ${msg.type}` } }));
      }
    });

    ws.on('close', () => {
      if (userId && projectId) {
        presenceManager.removeConnection(ws, userId, projectId);
        presenceManager.broadcastToProject(projectId, {
          type: 'presence:update',
          payload: { online: buildOnlinePayload(projectId) },
        });
      }
    });
  });

  return wss;
}
