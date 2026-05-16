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

export function createWsServer(server: Server): WebSocketServer {
  const wss = new WebSocketServer({ server, path: '/ws' });

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
