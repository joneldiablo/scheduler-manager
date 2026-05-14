import http from 'http';
import url from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { AppConfig } from '../env.js';
import { AuthService } from './auth-service.js';
import { WsEvent } from '../types.js';

export interface WsService {
  broadcast(event: WsEvent): void;
  getConnectionsCount(): number;
  close(): void;
}

const HEARTBEAT_INTERVAL = 30000;
const HEARTBEAT_TIMEOUT = 10000;

export function createWsServer(server: http.Server, config: AppConfig, auth: AuthService): WsService {
  const wss = new WebSocketServer({ server });
  let pingInterval: ReturnType<typeof setInterval> | null = null;

  wss.on('connection', (socket: WebSocket, req: http.IncomingMessage) => {
    const parsedUrl = url.parse(req.url || '', true);
    const token = parsedUrl.query.token as string | undefined;

    if (!token) {
      socket.send(JSON.stringify({ type: 'error', payload: { message: 'token required' }, timestamp: new Date().toISOString() }));
      socket.close(4001, 'unauthorized');
      return;
    }

    const payload = auth.verifyToken(token);
    if (!payload) {
      socket.send(JSON.stringify({ type: 'error', payload: { message: 'invalid token' }, timestamp: new Date().toISOString() }));
      socket.close(4001, 'unauthorized');
      return;
    }

    (socket as unknown as Record<string, unknown>).auth = payload;
    (socket as unknown as Record<string, unknown>).isAlive = true;

    socket.on('pong', () => {
      (socket as unknown as Record<string, unknown>).isAlive = true;
    });

    socket.send(JSON.stringify({
      type: 'connected',
      payload: { username: payload.username, connections_count: wss.clients.size },
      timestamp: new Date().toISOString(),
    }));

    socket.on('close', () => {
      (socket as unknown as Record<string, unknown>).isAlive = false;
    });

    socket.on('error', () => {
      (socket as unknown as Record<string, unknown>).isAlive = false;
    });
  });

  pingInterval = setInterval(() => {
    wss.clients.forEach((socket) => {
      const alive = (socket as unknown as Record<string, unknown>).isAlive;
      if (alive === false) {
        socket.terminate();
        return;
      }
      (socket as unknown as Record<string, unknown>).isAlive = false;
      socket.ping();
    });
  }, HEARTBEAT_INTERVAL);

  wss.on('close', () => {
    if (pingInterval) {
      clearInterval(pingInterval);
      pingInterval = null;
    }
  });

  return {
    broadcast(event: WsEvent) {
      const message = JSON.stringify(event);
      wss.clients.forEach((socket) => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(message);
        }
      });
    },

    getConnectionsCount() {
      return wss.clients.size;
    },

    close() {
      if (pingInterval) {
        clearInterval(pingInterval);
        pingInterval = null;
      }
      wss.close();
    },
  };
}
