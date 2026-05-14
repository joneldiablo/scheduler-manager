import { Router, Request, Response, NextFunction } from 'express';
import { AppConfig } from '../env.js';
import { AuthService } from '../services/auth-service.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { ApiResponse } from '../types.js';

function createAuthInlineMiddleware(auth: AuthService) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      const response: ApiResponse = {
        success: false,
        error: true,
        status: 401,
        code: 0,
        description: 'unauthorized',
      };
      res.status(401).json(response);
      return;
    }

    const token = authHeader.slice(7);
    const payload = auth.verifyToken(token);

    if (!payload) {
      const response: ApiResponse = {
        success: false,
        error: true,
        status: 401,
        code: 0,
        description: 'unauthorized',
      };
      res.status(401).json(response);
      return;
    }

    (req as AuthenticatedRequest).auth = payload;
    next();
  };
}

export function registerAuthRoutes(router: Router, config: AppConfig, auth: AuthService): void {
  const authRouter = Router();

  authRouter.post('/login', async (req: Request, res: Response) => {
    const { username, password } = req.body;

    if (!username || !password) {
      const response: ApiResponse = {
        success: false,
        error: true,
        status: 401,
        code: 0,
        description: 'invalid-credentials',
      };
      res.status(401).json(response);
      return;
    }

    const result = await auth.login(username, password);

    if (!result) {
      const response: ApiResponse = {
        success: false,
        error: true,
        status: 401,
        code: 0,
        description: 'invalid-credentials',
      };
      res.status(401).json(response);
      return;
    }

    const response: ApiResponse<typeof result> = {
      success: true,
      error: false,
      status: 200,
      code: 0,
      description: 'ok',
      data: result,
    };
    res.status(200).json(response);
  });

  const authMiddleware = createAuthInlineMiddleware(auth);

  authRouter.get('/me', authMiddleware, (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const response: ApiResponse<{ username: string; role: string }> = {
      success: true,
      error: false,
      status: 200,
      code: 0,
      description: 'ok',
      data: {
        username: authReq.auth!.username,
        role: authReq.auth!.role,
      },
    };
    res.status(200).json(response);
  });

  authRouter.post('/logout', authMiddleware, (req: Request, res: Response) => {
    const authHeader = req.headers.authorization!;
    const token = authHeader.slice(7);
    auth.revokeToken(token);

    const response: ApiResponse = {
      success: true,
      error: false,
      status: 200,
      code: 0,
      description: 'ok',
    };
    res.status(200).json(response);
  });

  router.use(`${config.API_PATH_PREFIX}/auth`, authRouter);
}
