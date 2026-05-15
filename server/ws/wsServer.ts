import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import * as presenceManager from './presenceManager.js';

interface WsMessage {
  type: string;
  payload: Record<string, unknown>;
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
          userId = msg.payload.userId as string;
          projectId = msg.payload.projectId as string;
          if (!userId || !projectId) {
            ws.send(JSON.stringify({ type: 'error', payload: { message: 'Missing userId or projectId' } }));
            return;
          }
          presenceManager.addConnection(ws, userId, projectId);
          const online = presenceManager.getOnlineUsers(projectId);
          presenceManager.broadcastToProject(projectId, {
            type: 'presence:update',
            payload: { online: online.map((u) => ({ userId: u.userId })) },
          }, userId);
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
        presenceManager.removeConnection(userId);
        presenceManager.broadcastToProject(projectId, {
          type: 'presence:update',
          payload: { online: presenceManager.getOnlineUsers(projectId).map((u) => ({ userId: u.userId })) },
        });
      }
    });
  });

  return wss;
}
