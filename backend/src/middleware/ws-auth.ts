import { IncomingMessage } from 'http';
import url from 'url';
import { AppConfig } from '../env.js';
import { AuthService } from '../services/auth-service.js';
import { AuthPayload } from '../types.js';
import { WebSocket } from 'ws';

export interface WsAuthenticatedRequest extends IncomingMessage {
  auth?: AuthPayload;
}

export function createWsAuthMiddleware(config: AppConfig, auth: AuthService) {
  return (socket: WebSocket, req: IncomingMessage, next: (err?: Error) => void): void => {
    const parsedUrl = url.parse(req.url || '', true);
    const token = parsedUrl.query.token as string | undefined;

    if (!token) {
      socket.close(4001, 'unauthorized');
      return;
    }

    const payload = auth.verifyToken(token);
    if (!payload) {
      socket.close(4001, 'unauthorized');
      return;
    }

    (req as WsAuthenticatedRequest).auth = payload;
    next();
  };
}
