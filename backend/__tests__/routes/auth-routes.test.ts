import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import type { AppConfig } from '../../src/env.js';

const mockAuth = {
  login: jest.fn<any>(),
  verifyToken: jest.fn<any>(),
  revokeToken: jest.fn<any>(),
};

const fakeRouter = {
  post: jest.fn().mockReturnThis(),
  get: jest.fn().mockReturnThis(),
  use: jest.fn(),
};

jest.unstable_mockModule('express', () => ({
  Router: jest.fn(() => fakeRouter),
}));

const { registerAuthRoutes } = await import('../../src/routes/auth-routes.js');

const defaultConfig: AppConfig = {
  API_PATH_PREFIX: '/api',
  HOST: '',
  PORT: 0,
  SUPERUSER_USER: '',
  SUPERUSER_PASS: '',
  JWT_SECRET: '',
  JWT_EXPIRES_IN: '',
  ENABLE_FRONTEND: false,
  DATA_ROOT: '',
  SQLITE_FILENAME: '',
  PLANNER_CRON: '',
  SEED_ON_BOOTSTRAP: false,
};

beforeEach(() => {
  jest.clearAllMocks();
});

type RouteArgs = [string, ...Function[]];

function captureMiddleware(method: 'post' | 'get', index: number): Function {
  const calls = (fakeRouter[method] as jest.Mock).mock.calls;
  const args = calls[index] as RouteArgs;
  return args[1];
}

function captureLastHandler(method: 'post' | 'get', index: number): Function {
  const calls = (fakeRouter[method] as jest.Mock).mock.calls;
  const args = calls[index] as RouteArgs;
  return args[args.length - 1];
}

function makeReqRes(body = {}, headers = {}) {
  const req: any = { body, headers };
  const res: any = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };
  return { req, res };
}

describe('registerAuthRoutes', () => {
  it('mounts authRouter at /api/auth prefix', () => {
    const mockUse = jest.fn();
    registerAuthRoutes({ use: mockUse } as any, defaultConfig, mockAuth);
    expect(mockUse).toHaveBeenCalledWith('/api/auth', fakeRouter);
  });

  describe('POST /login', () => {
    it('returns 401 when username is missing', async () => {
      registerAuthRoutes({ use: jest.fn() } as any, defaultConfig, mockAuth);
      const handler = captureLastHandler('post', 0);
      const { req, res } = makeReqRes({ password: 'somepass' });
      await handler(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false, error: true, status: 401, code: 0, description: 'invalid-credentials',
      });
    });

    it('returns 401 when password is missing', async () => {
      registerAuthRoutes({ use: jest.fn() } as any, defaultConfig, mockAuth);
      const handler = captureLastHandler('post', 0);
      const { req, res } = makeReqRes({ username: 'admin' });
      await handler(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('returns 401 when both username and password are missing', async () => {
      registerAuthRoutes({ use: jest.fn() } as any, defaultConfig, mockAuth);
      const handler = captureLastHandler('post', 0);
      const { req, res } = makeReqRes({});
      await handler(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('returns 401 when credentials are empty strings', async () => {
      registerAuthRoutes({ use: jest.fn() } as any, defaultConfig, mockAuth);
      const handler = captureLastHandler('post', 0);
      const { req, res } = makeReqRes({ username: '', password: '' });
      await handler(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('returns 401 when credentials are invalid', async () => {
      mockAuth.login.mockResolvedValueOnce(null);
      registerAuthRoutes({ use: jest.fn() } as any, defaultConfig, mockAuth);
      const handler = captureLastHandler('post', 0);
      const { req, res } = makeReqRes({ username: 'admin', password: 'wrong' });
      await handler(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('returns 200 with token when credentials are valid', async () => {
      const authResult = { token: 'jwt-token', user: { username: 'admin', role: 'superadmin' } };
      mockAuth.login.mockResolvedValueOnce(authResult);
      registerAuthRoutes({ use: jest.fn() } as any, defaultConfig, mockAuth);
      const handler = captureLastHandler('post', 0);
      const { req, res } = makeReqRes({ username: 'admin', password: 'secret' });
      await handler(req, res);
      expect(mockAuth.login).toHaveBeenCalledWith('admin', 'secret');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true, error: false, status: 200, code: 0, description: 'ok', data: authResult,
      });
    });
  });

  describe('GET /me', () => {
    it('returns 401 without auth header', async () => {
      registerAuthRoutes({ use: jest.fn() } as any, defaultConfig, mockAuth);
      const middleware = captureMiddleware('get', 0);
      const { req, res } = makeReqRes();
      const next = jest.fn();
      middleware(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false, error: true, status: 401, code: 0, description: 'unauthorized',
      });
    });

    it('returns 401 when token is invalid', async () => {
      mockAuth.verifyToken.mockReturnValueOnce(null);
      registerAuthRoutes({ use: jest.fn() } as any, defaultConfig, mockAuth);
      const middleware = captureMiddleware('get', 0);
      const { req, res } = makeReqRes({}, { authorization: 'Bearer bad-token' });
      const next = jest.fn();
      middleware(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('returns user data when authenticated', async () => {
      mockAuth.verifyToken.mockReturnValueOnce({ username: 'admin', role: 'superadmin' });
      registerAuthRoutes({ use: jest.fn() } as any, defaultConfig, mockAuth);
      const middleware = captureMiddleware('get', 0);
      const handler = captureLastHandler('get', 0);
      const { req, res } = makeReqRes({}, { authorization: 'Bearer valid-token' });
      const next = jest.fn();
      middleware(req, res, next);
      expect(next).toHaveBeenCalled();
      handler(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true, error: false, status: 200, code: 0, description: 'ok',
        data: { username: 'admin', role: 'superadmin' },
      });
    });
  });

  describe('POST /logout', () => {
    it('returns 401 without auth header', async () => {
      registerAuthRoutes({ use: jest.fn() } as any, defaultConfig, mockAuth);
      const middleware = captureMiddleware('post', 1);
      const { req, res } = makeReqRes();
      const next = jest.fn();
      middleware(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('returns 401 when token is invalid', async () => {
      mockAuth.verifyToken.mockReturnValueOnce(null);
      registerAuthRoutes({ use: jest.fn() } as any, defaultConfig, mockAuth);
      const middleware = captureMiddleware('post', 1);
      const { req, res } = makeReqRes({}, { authorization: 'Bearer bad-token' });
      const next = jest.fn();
      middleware(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('revokes token and returns ok', async () => {
      mockAuth.verifyToken.mockReturnValueOnce({ username: 'admin', role: 'superadmin' });
      registerAuthRoutes({ use: jest.fn() } as any, defaultConfig, mockAuth);
      const middleware = captureMiddleware('post', 1);
      const handler = captureLastHandler('post', 1);
      const { req, res } = makeReqRes({}, { authorization: 'Bearer token-to-revoke' });
      const next = jest.fn();
      middleware(req, res, next);
      expect(next).toHaveBeenCalled();
      handler(req, res);
      expect(mockAuth.revokeToken).toHaveBeenCalledWith('token-to-revoke');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true, error: false, status: 200, code: 0, description: 'ok',
      });
    });
  });
});
