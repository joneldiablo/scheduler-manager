import { jest } from '@jest/globals';
import { createAuthMiddleware } from '../../src/middleware/auth.js';

const mockAuth = {
  verifyToken: jest.fn() as any,
  login: jest.fn() as any,
  revokeToken: jest.fn() as any,
};

const defaultConfig = {
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

function createMockReqRes(reqOverrides = {}) {
  const req: any = {
    path: '/api/tasks',
    headers: {},
    ...reqOverrides,
  };
  const res: any = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };
  const next = jest.fn();
  return { req, res, next };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('createAuthMiddleware', () => {
  it('calls next() for public path /api/auth/login', () => {
    const middleware = createAuthMiddleware(defaultConfig, mockAuth);
    const { req, res, next } = createMockReqRes({ path: '/api/auth/login' });
    middleware(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('calls next() for public path /health', () => {
    const middleware = createAuthMiddleware(defaultConfig, mockAuth);
    const { req, res, next } = createMockReqRes({ path: '/health' });
    middleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('calls next() for public path /api/health', () => {
    const middleware = createAuthMiddleware(defaultConfig, mockAuth);
    const { req, res, next } = createMockReqRes({ path: '/api/health' });
    middleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('calls next() for public path with custom API_PATH_PREFIX', () => {
    const config = { ...defaultConfig, API_PATH_PREFIX: '/custom-api' };
    const middleware = createAuthMiddleware(config, mockAuth);
    const { req, res, next } = createMockReqRes({ path: '/custom-api/auth/login' });
    middleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('calls next() for any path starting with a public path prefix', () => {
    const middleware = createAuthMiddleware(defaultConfig, mockAuth);
    const { req, res, next } = createMockReqRes({ path: '/health/check' });
    middleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('returns 401 when no Authorization header', () => {
    const middleware = createAuthMiddleware(defaultConfig, mockAuth);
    const { req, res, next } = createMockReqRes();
    middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: true,
      status: 401,
      code: 0,
      description: 'unauthorized',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when Authorization header does not start with Bearer', () => {
    const middleware = createAuthMiddleware(defaultConfig, mockAuth);
    const { req, res, next } = createMockReqRes({
      headers: { authorization: 'Basic abc123' },
    });
    middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when Authorization header is empty string', () => {
    const middleware = createAuthMiddleware(defaultConfig, mockAuth);
    const { req, res, next } = createMockReqRes({
      headers: { authorization: '' },
    });
    middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when token is invalid (verifyToken returns null)', () => {
    mockAuth.verifyToken.mockReturnValueOnce(null);
    const middleware = createAuthMiddleware(defaultConfig, mockAuth);
    const { req, res, next } = createMockReqRes({
      headers: { authorization: 'Bearer invalid-token' },
    });
    middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('sets req.auth and calls next() when token is valid', () => {
    const payload = { username: 'admin', role: 'superadmin', iat: 123, exp: 456 };
    mockAuth.verifyToken.mockReturnValueOnce(payload);
    const middleware = createAuthMiddleware(defaultConfig, mockAuth);
    const { req, res, next } = createMockReqRes({
      headers: { authorization: 'Bearer valid-token' },
    });
    middleware(req, res, next);
    expect(req.auth).toEqual(payload);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('passes the exact token from header to auth.verifyToken', () => {
    mockAuth.verifyToken.mockReturnValueOnce({ username: 'admin', role: 'superadmin' });
    const middleware = createAuthMiddleware(defaultConfig, mockAuth);
    const { req, res, next } = createMockReqRes({
      headers: { authorization: 'Bearer  my-token-with-spaces ' },
    });
    middleware(req, res, next);
    expect(mockAuth.verifyToken).toHaveBeenCalledWith(' my-token-with-spaces ');
    expect(next).toHaveBeenCalled();
  });

  it('does not call verifyToken for public paths', () => {
    const middleware = createAuthMiddleware(defaultConfig, mockAuth);
    const { req, res, next } = createMockReqRes({ path: '/api/auth/login' });
    middleware(req, res, next);
    expect(mockAuth.verifyToken).not.toHaveBeenCalled();
  });
});
