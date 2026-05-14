import { jest } from '@jest/globals';
import url from 'url';
import { createWsAuthMiddleware } from '../../src/middleware/ws-auth.js';

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

function createMockSocket() {
  return { close: jest.fn() } as any;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('createWsAuthMiddleware', () => {
  it('calls next() when valid token is provided in query params', () => {
    jest.spyOn(url, 'parse').mockReturnValueOnce({
      query: { token: 'valid-token' },
    } as any);
    mockAuth.verifyToken.mockReturnValueOnce({ username: 'admin', role: 'superadmin' });

    const middleware = createWsAuthMiddleware(defaultConfig, mockAuth);
    const socket = createMockSocket();
    const req = { url: '/ws?token=valid-token' } as any;
    const next = jest.fn();

    middleware(socket, req, next);

    expect(mockAuth.verifyToken).toHaveBeenCalledWith('valid-token');
    expect(next).toHaveBeenCalled();
    expect(socket.close).not.toHaveBeenCalled();
  });

  it('closes socket with 4001 when no token is provided', () => {
    jest.spyOn(url, 'parse').mockReturnValueOnce({
      query: {},
    } as any);

    const middleware = createWsAuthMiddleware(defaultConfig, mockAuth);
    const socket = createMockSocket();
    const req = { url: '/ws' } as any;
    const next = jest.fn();

    middleware(socket, req, next);

    expect(socket.close).toHaveBeenCalledWith(4001, 'unauthorized');
    expect(next).not.toHaveBeenCalled();
    expect(mockAuth.verifyToken).not.toHaveBeenCalled();
  });

  it('closes socket with 4001 when token query param is empty string', () => {
    jest.spyOn(url, 'parse').mockReturnValueOnce({
      query: { token: '' },
    } as any);

    const middleware = createWsAuthMiddleware(defaultConfig, mockAuth);
    const socket = createMockSocket();
    const req = { url: '/ws?token=' } as any;
    const next = jest.fn();

    middleware(socket, req, next);

    expect(socket.close).toHaveBeenCalledWith(4001, 'unauthorized');
    expect(next).not.toHaveBeenCalled();
  });

  it('closes socket with 4001 when token is invalid', () => {
    jest.spyOn(url, 'parse').mockReturnValueOnce({
      query: { token: 'bad-token' },
    } as any);
    mockAuth.verifyToken.mockReturnValueOnce(null);

    const middleware = createWsAuthMiddleware(defaultConfig, mockAuth);
    const socket = createMockSocket();
    const req = { url: '/ws?token=bad-token' } as any;
    const next = jest.fn();

    middleware(socket, req, next);

    expect(socket.close).toHaveBeenCalledWith(4001, 'unauthorized');
    expect(next).not.toHaveBeenCalled();
  });

  it('sets auth on req when token is valid', () => {
    const payload = { username: 'admin', role: 'superadmin', iat: 123, exp: 456 };
    jest.spyOn(url, 'parse').mockReturnValueOnce({
      query: { token: 'valid-token' },
    } as any);
    mockAuth.verifyToken.mockReturnValueOnce(payload);

    const middleware = createWsAuthMiddleware(defaultConfig, mockAuth);
    const socket = createMockSocket();
    const req = { url: '/ws?token=valid-token' } as any;
    const next = jest.fn();

    middleware(socket, req, next);

    expect(req.auth).toEqual(payload);
    expect(next).toHaveBeenCalled();
  });

  it('parses token correctly from URL query string', () => {
    const parseSpy = jest.spyOn(url, 'parse');
    const middleware = createWsAuthMiddleware(defaultConfig, mockAuth);
    const socket = createMockSocket();
    const req = { url: '/ws?token=my-test-token' } as any;
    const next = jest.fn();

    middleware(socket, req, next);

    expect(parseSpy).toHaveBeenCalledWith('/ws?token=my-test-token', true);
  });

  it('handles request with no url gracefully', () => {
    jest.spyOn(url, 'parse').mockReturnValueOnce({
      query: {},
    } as any);

    const middleware = createWsAuthMiddleware(defaultConfig, mockAuth);
    const socket = createMockSocket();
    const req = {} as any;
    const next = jest.fn();

    middleware(socket, req, next);

    expect(socket.close).toHaveBeenCalledWith(4001, 'unauthorized');
    expect(next).not.toHaveBeenCalled();
  });

  it('handles token with special characters in query string', () => {
    jest.spyOn(url, 'parse').mockReturnValueOnce({
      query: { token: 'eyJhbGciOiJIUzI1NiJ9.eyJ1c2VyIjoiYWRtaW4ifQ.' },
    } as any);
    mockAuth.verifyToken.mockReturnValueOnce({ username: 'admin', role: 'superadmin' });

    const middleware = createWsAuthMiddleware(defaultConfig, mockAuth);
    const socket = createMockSocket();
    const req = { url: '/ws' } as any;
    const next = jest.fn();

    middleware(socket, req, next);

    expect(mockAuth.verifyToken).toHaveBeenCalledWith('eyJhbGciOiJIUzI1NiJ9.eyJ1c2VyIjoiYWRtaW4ifQ.');
    expect(next).toHaveBeenCalled();
  });
});
