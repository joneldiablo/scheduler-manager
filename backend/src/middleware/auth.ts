import { Request, Response, NextFunction } from 'express';
import { AppConfig } from '../env.js';
import { AuthService } from '../services/auth-service.js';
import { AuthPayload, ApiResponse } from '../types.js';

export interface AuthenticatedRequest extends Request {
  auth?: AuthPayload;
}

const UNAUTHORIZED_RESPONSE: ApiResponse = {
  success: false,
  error: true,
  status: 401,
  code: 0,
  description: 'unauthorized',
};

export function createAuthMiddleware(config: AppConfig, auth: AuthService) {
  const publicPaths = [
    `${config.API_PATH_PREFIX}/auth/login`,
    '/health',
    '/api/health',
  ];

  const isPublicPath = (path: string): boolean => {
    return publicPaths.some((p) => path.startsWith(p));
  };

  return (req: Request, res: Response, next: NextFunction): void => {
    if (isPublicPath(req.path)) {
      next();
      return;
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json(UNAUTHORIZED_RESPONSE);
      return;
    }

    const token = authHeader.slice(7);
    const payload = auth.verifyToken(token);

    if (!payload) {
      res.status(401).json(UNAUTHORIZED_RESPONSE);
      return;
    }

    (req as AuthenticatedRequest).auth = payload;
    next();
  };
}
